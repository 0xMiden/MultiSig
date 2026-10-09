'use client';

import { useMultisig } from '@/contexts/MultisigContext';
import { useAdminTarget } from '@/contexts/AdminTargetContext';
import { AdminTargetSwitcher } from '@/components/admin/AdminTargetSwitcher';
import { shortFaucetId } from '@/lib/tokenAmounts';
import { roleLabel, type AdminTargetProfile } from '@/lib/admin/target';
import type { RoleFlags } from '@/lib/admin/roles';

/**
 * Persistent, prominent banner for the admin mask: network, the contract being administered (USDCx
 * faucet or AggLayer bridge), the loaded acting multisig, and the roles held on that contract.
 * Renders a distinct error treatment when role detection fails -- this never silently renders as
 * if no roles were held, since that is indistinguishable from "really holds no roles" (see
 * `useAdminTargets`).
 */
export function AdminBanner() {
  const { multisig, walletSource, midenWalletSession } = useMultisig();
  const { state, configured, active, activeKind } = useAdminTarget();
  const target = active?.target ?? null;
  const ready = active?.status === 'ready' ? active : null;

  const breadConnected = walletSource === 'miden-wallet' && midenWalletSession.connected;
  // Bread's roles are only evaluated (and its direct actions only sent) while Bread is the active
  // wallet source; a Bread session kept alive behind another source would otherwise just vanish
  // from this banner, which reads as "Bread holds no roles".
  const breadInactive = walletSource !== 'miden-wallet' && midenWalletSession.connected;
  const heldRoles = heldOf(target, ready?.roles ?? null);
  const breadHeldRoles = heldOf(target, ready?.breadRoles ?? null);
  const isError = active?.status === 'error';
  const loading = state.status === 'loading';
  const nowhere = state.status === 'ready' && !activeKind;
  const shown = target ?? configured[0] ?? null;
  const nobody = !multisig && !breadConnected;

  return (
    <div
      className={`rounded-[10px] border p-4 md:p-5 flex flex-col gap-3 ${
        isError ? 'border-red-200 bg-red-50' : 'border-[#FF5500]/25 bg-[#FF5500]/5'
      }`}
    >
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-[8px] bg-[#FF5500]/10 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-[#FF5500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div className="text-[14px] font-[600] text-[#111]">{active?.target.labels.consoleTitle ?? 'Admin Console'}</div>
        </div>
        <AdminTargetSwitcher />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.45)]">Network</div>
          <div className="text-[12px] font-[500] text-[#111] mt-0.5">{shown?.networkId || 'Not configured'}</div>
        </div>
        <div>
          <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.45)]">{shown ? shown.labels.contractNoun : 'Contract'}</div>
          <div className="text-[12px] font-[500] font-mono text-[#111] mt-0.5" title={shown?.contractId}>
            {shown?.contractId ? shortFaucetId(shown.contractId) : 'Not configured'}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.45)]">Acting multisig</div>
          <div className="text-[12px] font-[500] font-mono text-[#111] mt-0.5" title={multisig?.accountId ?? ''}>
            {multisig ? shortFaucetId(multisig.accountId) : 'No account loaded'}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.45)] mb-1.5">Detected roles</div>
        {loading && nobody && (
          <div className="text-[12px] text-[rgba(0,0,0,0.5)]">Load a multisig or connect Bread to detect roles.</div>
        )}
        {loading && !nobody && (
          <div className="flex items-center gap-2 text-[12px] text-[rgba(0,0,0,0.5)]">
            <div className="w-3.5 h-3.5 shrink-0 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin" />
            Detecting roles…
          </div>
        )}
        {active?.status === 'error' && (
          <div role="alert" className="text-[12px] font-[500] text-red-700">
            {active.message}
          </div>
        )}
        {nowhere && <div className="text-[12px] text-[rgba(0,0,0,0.5)]">No admin roles are held on any configured contract.</div>}
        {ready && (
          <div className="flex flex-col gap-1.5">
            {ready.roles && (
              <RoleRow
                label="Acting multisig"
                roles={heldRoles}
                none={`No admin roles are held on this ${ready.target.labels.contractNoun} by the acting multisig.`}
              />
            )}
            {ready.breadRoles && (
              <RoleRow
                label={`Bread account ${ready.breadAccountId ? shortFaucetId(ready.breadAccountId) : ''}`}
                roles={breadHeldRoles}
                none={`The connected Bread account holds no roles on this ${ready.target.labels.contractNoun}.`}
                hint={breadHeldRoles.length > 0 ? 'Its actions are signed and sent by Bread directly, without a proposal.' : undefined}
              />
            )}
          </div>
        )}
        {breadInactive && (
          <div className="text-[12px] text-[rgba(0,0,0,0.5)] mt-1.5">
            Bread is connected but not the active wallet source, so its roles are not evaluated. Select Bread as the
            wallet source (top right) to act with the roles its account holds.
          </div>
        )}
      </div>
    </div>
  );
}

/** Display labels of the roles a party holds on the target. */
function heldOf(target: AdminTargetProfile | null, flags: RoleFlags | null): string[] {
  if (!flags || !target) return [];
  return Object.entries(flags)
    .filter(([, held]) => held)
    .map(([symbol]) => roleLabel(target, symbol));
}

/** One party's held roles: a label, its chips, or the `none` sentence when it holds nothing. */
function RoleRow({ label, roles, none, hint }: { label: string; roles: readonly string[]; none: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-[500] text-[rgba(0,0,0,0.55)] mr-0.5">{label}:</span>
      {roles.length === 0 ? (
        <span className="text-[12px] text-[rgba(0,0,0,0.5)]">{none}</span>
      ) : (
        roles.map((role) => (
          <span key={role} className="text-[11px] font-[500] px-2 py-1 rounded-full bg-[#28A857]/10 text-[#1F7A3F]">
            {role}
          </span>
        ))
      )}
      {hint && <span className="text-[11px] text-[rgba(0,0,0,0.45)] basis-full">{hint}</span>}
    </div>
  );
}
