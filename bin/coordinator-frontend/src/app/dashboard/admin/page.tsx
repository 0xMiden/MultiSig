'use client';

import { useMemo, type ComponentType } from 'react';
import { isAdminMode } from '@/config/appMode';
import { useMultisig } from '@/contexts/MultisigContext';
import { useFaucetRoles } from '@/hooks/useFaucetRoles';
import { useFaucetAccountBytes, type FaucetBytesState } from '@/hooks/useFaucetAccountBytes';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { resolveActionSender, type ActionSender } from '@/lib/admin/directAction';
import { decodeRecipeLabel, type AdminAction, type AdminRecipe } from '@/lib/admin/recipe';
import { AdminFundingCard } from './components/AdminFundingCard';
import { FaucetStateCard } from './components/FaucetStateCard';
import { AdminProposalList } from './components/AdminProposalList';
import { LockedActionCard } from './components/LockedActionCard';
import { SetMaxSupplyForm, SetMinBurnForm, SetNoteFeeForm } from './components/SupplyBurnFeeForms';
import { RbacGrantForm, RbacRevokeForm } from './components/RbacForms';
import { SetAttesterForm } from './components/AttesterForm';
import { PauseForm, UnpauseForm } from './components/PauseForms';
import { BlocklistForm } from './components/BlocklistForm';

export const dynamic = 'force-dynamic';

type ActionFormProps = { faucetBytesState: FaucetBytesState; inflightRecipes: AdminRecipe[]; sender?: ActionSender };

/** Every admin action with the form that creates it, in display order. */
const ACTION_FORMS: { action: AdminAction; Form: ComponentType<ActionFormProps> }[] = [
  { action: 'set_max_supply', Form: SetMaxSupplyForm },
  { action: 'set_min_burn', Form: SetMinBurnForm },
  { action: 'set_note_fee', Form: SetNoteFeeForm },
  { action: 'rbac_grant', Form: RbacGrantForm },
  { action: 'rbac_revoke', Form: RbacRevokeForm },
  { action: 'set_attester', Form: SetAttesterForm },
  { action: 'pause', Form: PauseForm },
  { action: 'unpause', Form: UnpauseForm },
  { action: 'blocklist', Form: BlocklistForm },
];

export default function AdminPage() {
  const { proposals, multisig, walletSource, midenWalletSession } = useMultisig();
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

  // Two parties can hold roles: the acting multisig (actions become proposals) and the account
  // connected through Bread (actions are sent by Bread directly). Each action goes to the first
  // of the two that holds its role; see `resolveActionSender`.
  const breadConnected = walletSource === 'miden-wallet' && midenWalletSession.connected;
  const anyone = multisig !== null || breadConnected;
  const rolesKnown = anyone && rolesState.status === 'ready';
  const senderFor = (action: AdminAction): ActionSender | null =>
    rolesState.status === 'ready' ? resolveActionSender(action, rolesState.roles, rolesState.breadRoles) : null;
  const canAct = (action: AdminAction): boolean => senderFor(action) !== null;
  const holdsAnyRole = ACTION_FORMS.some(({ action }) => canAct(action));

  // Usable actions first, each group in its listed order (Array.prototype.sort is stable).
  const orderedActions = [...ACTION_FORMS].sort((a, b) => Number(canAct(b.action)) - Number(canAct(a.action)));

  // Every action is listed whenever the roles are known, or there is nobody to have any:
  // usable ones as forms, the rest locked. While roles are still being detected, or could not be
  // determined, nothing is listed -- "locked" would then be a guess presented as a fact.
  const showActions = !anyone || rolesKnown;

  return (
    <div className="flex flex-col w-full h-full gap-4 p-2 md:p-4">
      <AdminBanner />
      <AdminFundingCard />
      <FaucetStateCard faucetBytesState={faucetBytesState} />

      {!anyone && (
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          No multisig is loaded yet. Connect your wallet (top right) to load it and unlock the actions its roles allow.
          An account connected through Bread that holds a role itself can also act directly.
        </div>
      )}

      {anyone && rolesState.status === 'loading' && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-[#FF5500] border-t-transparent rounded-full animate-spin" />
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">Detecting admin roles…</div>
          </div>
        </div>
      )}

      {anyone && rolesState.status === 'error' && (
        <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 p-4 md:p-5 text-[13px] text-red-700">
          {rolesState.message}
        </div>
      )}

      {rolesKnown && !holdsAnyRole && (
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          {multisig && breadConnected
            ? 'Neither the acting multisig nor the connected Bread account holds a role on this faucet'
            : multisig
              ? 'The acting multisig holds no roles on this faucet'
              : 'The connected Bread account holds no roles on this faucet'}
          , so every action below is locked. The Roles page shows who holds each role.
        </div>
      )}

      {showActions && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {orderedActions.map(({ action, Form }) => {
            const sender = senderFor(action);
            return sender ? (
              <Form key={action} faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} sender={sender} />
            ) : (
              <LockedActionCard key={action} action={action} />
            );
          })}
        </div>
      )}

      {rolesKnown && multisig && <AdminProposalList proposals={proposals} />}
    </div>
  );
}
