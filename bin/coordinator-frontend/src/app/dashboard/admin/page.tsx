'use client';

import { useMemo } from 'react';
import { isAdminMode } from '@/config/appMode';
import { useMultisig } from '@/contexts/MultisigContext';
import { useFaucetRoles } from '@/hooks/useFaucetRoles';
import { useFaucetAccountBytes } from '@/hooks/useFaucetAccountBytes';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { ACTION_ROLE } from '@/lib/admin/roles';
import { decodeRecipeLabel, type AdminAction, type AdminRecipe } from '@/lib/admin/recipe';
import { AdminFundingCard } from './components/AdminFundingCard';
import { AdminProposalList } from './components/AdminProposalList';
import { SetMaxSupplyForm, SetMinBurnForm, SetNoteFeeForm } from './components/SupplyBurnFeeForms';
import { RbacGrantForm, RbacRevokeForm } from './components/RbacForms';
import { SetAttesterForm } from './components/AttesterForm';
import { PauseForm, UnpauseForm } from './components/PauseForms';
import { BlocklistForm } from './components/BlocklistForm';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const { proposals, multisig } = useMultisig();
  const rolesState = useFaucetRoles();
  const faucetBytesState = useFaucetAccountBytes();

  // Other not-yet-finalized admin proposals, for the revoke-in-flight guardrail. Memoized so a
  // guardrail check doesn't get a new array identity on every render for no reason.
  const inflightRecipes = useMemo<AdminRecipe[]>(() => {
    return proposals
      .filter((p) => p.metadata.proposalType === 'custom' && p.status !== 'finalized')
      .map((p) => (p.metadata.proposalType === 'custom' ? decodeRecipeLabel(p.metadata.rawProposalType) : null))
      .filter((r): r is AdminRecipe => r !== null);
  }, [proposals]);

  if (!isAdminMode) {
    return (
      <div className="flex flex-col w-full h-full p-4">
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          The admin console is disabled in this build. Set <code className="font-mono">NEXT_PUBLIC_APP_MODE=admin</code> to
          enable it.
        </div>
      </div>
    );
  }

  const canAct = (action: AdminAction): boolean =>
    rolesState.status === 'ready' && rolesState.roles[ACTION_ROLE[action]];

  return (
    <div className="flex flex-col w-full h-full gap-4 p-2 md:p-4">
      <AdminBanner />
      <AdminFundingCard />

      {/* Roles are detected for the loaded multisig, so with none loaded there is nothing to
          wait for: say what is missing instead of spinning. */}
      {!multisig && (
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          No multisig is loaded yet. Connect your wallet (top right) to load it and see the actions its roles allow.
        </div>
      )}

      {multisig && rolesState.status === 'loading' && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-[#FF5500] border-t-transparent rounded-full animate-spin" />
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">Detecting admin roles…</div>
          </div>
        </div>
      )}

      {rolesState.status === 'error' && (
        <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 p-4 md:p-5 text-[13px] text-red-700">
          {rolesState.message}
        </div>
      )}

      {rolesState.status === 'ready' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
            {canAct('set_max_supply') && (
              <SetMaxSupplyForm faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} />
            )}
            {canAct('set_min_burn') && (
              <SetMinBurnForm faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} />
            )}
            {canAct('set_note_fee') && (
              <SetNoteFeeForm faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} />
            )}
            {canAct('rbac_grant') && (
              <RbacGrantForm faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} />
            )}
            {canAct('rbac_revoke') && (
              <RbacRevokeForm faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} />
            )}
            {canAct('set_attester') && (
              <SetAttesterForm faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} />
            )}
            {canAct('pause') && <PauseForm faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} />}
            {canAct('unpause') && (
              <UnpauseForm faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} />
            )}
            {canAct('blocklist') && (
              <BlocklistForm faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} />
            )}
          </div>

          {!Object.values(ACTION_ROLE).some((role) => rolesState.roles[role]) && (
            <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
              The acting multisig holds no admin roles on this faucet, so no actions are available.
            </div>
          )}

          <AdminProposalList proposals={proposals} />
        </>
      )}
    </div>
  );
}
