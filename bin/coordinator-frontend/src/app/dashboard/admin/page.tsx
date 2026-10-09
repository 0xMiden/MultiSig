'use client';

import { useMemo, type ComponentType } from 'react';
import { isAdminMode } from '@/config/appMode';
import { useMultisig } from '@/contexts/MultisigContext';
import { useAdminTarget } from '@/contexts/AdminTargetContext';
import { bytesStateOf, type FaucetBytesState } from '@/hooks/useAdminTargets';
import { AdminBanner } from '@/components/admin/AdminBanner';
import { resolveActionSender, type ActionSender } from '@/lib/admin/directAction';
import { allReadable, failedEvaluations } from '@/lib/admin/targetSelection';
import { actionFormKey, type AdminTarget } from '@/lib/admin/target';
import { decodeRecipeLabel, type AdminAction, type AdminRecipe } from '@/lib/admin/recipe';
import { AdminFundingCard } from './components/AdminFundingCard';
import { FaucetStateCard } from './components/FaucetStateCard';
import { BridgeStateCard } from './components/BridgeStateCard';
import { AdminProposalList } from './components/AdminProposalList';
import { LockedActionCard } from './components/LockedActionCard';
import { SetMaxSupplyForm, SetMinBurnForm, SetNoteFeeForm } from './components/SupplyBurnFeeForms';
import { RbacGrantForm, RbacRevokeForm, RbacSetAdminForm, RbacRenounceForm } from './components/RbacForms';
import { SetAttesterForm } from './components/AttesterForm';
import { PauseForm, UnpauseForm } from './components/PauseForms';
import { BlocklistForm } from './components/BlocklistForm';

export const dynamic = 'force-dynamic';

type ActionFormProps = { faucetBytesState: FaucetBytesState; inflightRecipes: AdminRecipe[]; sender?: ActionSender };

/** The form that creates each admin action; which ones a target offers comes from its profile. */
const FORM_OF: Record<AdminAction, ComponentType<ActionFormProps>> = {
  set_max_supply: SetMaxSupplyForm,
  set_min_burn: SetMinBurnForm,
  set_note_fee: SetNoteFeeForm,
  rbac_grant: RbacGrantForm,
  rbac_revoke: RbacRevokeForm,
  rbac_set_admin: RbacSetAdminForm,
  rbac_renounce: RbacRenounceForm,
  set_attester: SetAttesterForm,
  pause: PauseForm,
  unpause: UnpauseForm,
  blocklist: BlocklistForm,
};

export default function AdminPage() {
  const { proposals, multisig, walletSource, midenWalletSession } = useMultisig();
  const { state, configured, active, activeKind } = useAdminTarget();
  const faucetBytesState = useMemo(() => bytesStateOf(active, state), [active, state]);

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
  const rolesKnown = anyone && state.status === 'ready';
  const target: AdminTarget | null = active?.target ?? null;
  const senderFor = (action: AdminAction): ActionSender | null =>
    active && active.status === 'ready' ? resolveActionSender(action, active.target, active.roles, active.breadRoles) : null;
  const canAct = (action: AdminAction): boolean => senderFor(action) !== null;

  // Usable actions first, each group in its listed order (Array.prototype.sort is stable).
  const actions = target ? [...target.actions].sort((a, b) => Number(canAct(b)) - Number(canAct(a))) : [];
  const evaluations = state.status === 'ready' ? state.evaluations : [];
  const failed = failedEvaluations(evaluations);

  // Actions are listed only once the roles are known and a target holds some: usable ones as
  // forms, the rest locked. While roles are still being detected, or could not be determined,
  // nothing is listed -- "locked" would then be a guess presented as a fact.
  const showActions = rolesKnown && target !== null;

  return (
    <div className="flex flex-col w-full h-full gap-4 p-2 md:p-4">
      <AdminBanner />
      <AdminFundingCard />
      {target?.kind === 'usdcx' ? (
        <FaucetStateCard faucetBytesState={faucetBytesState} />
      ) : target?.kind === 'agglayer' ? (
        <BridgeStateCard faucetBytesState={faucetBytesState} target={target} />
      ) : null}

      {!anyone && (
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          No multisig is loaded yet. Connect your wallet (top right) to load it and unlock the actions its roles allow.
          An account connected through Bread that holds a role itself can also act directly
          {midenWalletSession.connected
            ? ' -- Bread is connected but not the active wallet source; select Bread as the wallet source to use its roles.'
            : '.'}
        </div>
      )}

      {anyone && state.status === 'loading' && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-[#FF5500] border-t-transparent rounded-full animate-spin" />
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">Detecting admin roles…</div>
          </div>
        </div>
      )}

      {anyone &&
        failed.map((e) => (
          <div key={e.target.kind} role="alert" className="rounded-[10px] border border-red-200 bg-red-50 p-4 md:p-5 text-[13px] text-red-700">
            {e.message}
          </div>
        ))}

      {rolesKnown && !activeKind && allReadable(evaluations) && (
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          {configured.length === 0
            ? 'No contract is configured for this console (NEXT_PUBLIC_USDCX_FAUCET_ID / NEXT_PUBLIC_AGGLAYER_BRIDGE_ID).'
            : `Neither the acting multisig nor the connected Bread account holds a role on ${configured.map((t) => `the ${t.labels.contractNoun} (${t.contractId})`).join(' or ')}. The Roles page shows who does.`}
        </div>
      )}

      {showActions && target && (
        <div key={target.kind} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {actions.map((action) => {
            const Form = FORM_OF[action];
            const sender = senderFor(action);
            return sender ? (
              <Form key={actionFormKey(target.kind, action)} faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} sender={sender} />
            ) : (
              <LockedActionCard key={actionFormKey(target.kind, action)} action={action} target={target} />
            );
          })}
        </div>
      )}

      {rolesKnown && multisig && <AdminProposalList proposals={proposals} />}
    </div>
  );
}
