'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { isAdminMode } from '@/config/appMode';
import { useMultisig } from '@/contexts/MultisigContext';
import { useAdminTarget } from '@/contexts/AdminTargetContext';
import { bytesStateOf, type FaucetBytesState } from '@/hooks/useAdminTargets';
import { copyToClipboard } from '@/lib/helpers';
import { initAdminWasm } from '@/lib/admin/noteBuilders';
import { actionLabel, actionsOfRole, listRoleHolders } from '@/lib/admin/roles';
import type { AdminTarget, AdminTargetKind } from '@/lib/admin/target';

export const dynamic = 'force-dynamic';

type HoldersState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; holders: Record<string, string[]> };

const sameAccount = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Lists who holds each of the target's roles, from its account bytes. Remounted (via `key`) on
 * refresh so the holders are always re-derived from the bytes just re-fetched.
 */
function RoleHolders({ target, bytesState }: { target: AdminTarget; bytesState: FaucetBytesState }) {
  const { multisig } = useMultisig();
  const faucetBytes = bytesState;
  const [state, setState] = useState<HoldersState>({ status: 'loading' });

  useEffect(() => {
    if (faucetBytes.status === 'loading') {
      setState({ status: 'loading' });
      return;
    }
    if (faucetBytes.status === 'error') {
      setState({ status: 'error', message: faucetBytes.message });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await initAdminWasm();
        const holders = listRoleHolders(faucetBytes.bytes, target);
        if (!cancelled) setState({ status: 'ready', holders });
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setState({ status: 'error', message: `Could not read the ${target.labels.contractNoun}'s role holders: ${message}` });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [faucetBytes, target]);

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[#FF5500] border-t-transparent rounded-full animate-spin" />
          <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">Reading the {target.labels.contractNoun}…</div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 p-4 md:p-5 text-[13px] text-red-700">
        {state.message}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
      {target.roles.map((role) => {
        const holders = state.holders[role.symbol] ?? [];
        return (
          <div key={role.symbol} className="rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white p-4 md:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[14px] font-[600] font-mono text-[#111]">{role.label}</div>
              <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.45)] shrink-0">
                {holders.length === 1 ? '1 holder' : `${holders.length} holders`}
              </div>
            </div>

            <div className="text-[12px] text-[rgba(0,0,0,0.55)]">
              Can: {actionsOfRole(target, role.symbol).map((action) => actionLabel(target, action).toLowerCase()).join(', ')}.
            </div>

            {holders.length === 0 ? (
              <div className="text-[12px] text-[rgba(0,0,0,0.45)]">No account holds this role.</div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {holders.map((holder) => (
                  <li key={holder} className="flex items-center gap-2 min-w-0">
                    <span className="text-[12px] font-mono text-[#111] break-all">{holder}</span>
                    {multisig && sameAccount(holder, multisig.accountId) && (
                      <span className="text-[11px] font-[500] px-2 py-0.5 rounded-full bg-[#28A857]/10 text-[#1F7A3F] shrink-0">
                        This multisig
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(holder, () => toast.success('Account id copied'))}
                      className="text-[11px] font-[500] text-[#FF5500] hover:underline shrink-0"
                    >
                      Copy
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminRolesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { state, configured, activeKind, refresh } = useAdminTarget();
  const [inspect, setInspect] = useState<AdminTargetKind | null>(null);
  const kind = inspect ?? activeKind ?? configured[0]?.kind ?? null;
  const target = configured.find((t) => t.kind === kind) ?? null;
  const evaluation = state.status === 'ready' ? (state.evaluations.find((e) => e.target.kind === kind) ?? null) : null;
  const bytesState = useMemo(() => bytesStateOf(evaluation, state), [evaluation, state]);

  // Inspection only: the banner switcher is the one control that changes the active console.
  const select = (next: AdminTargetKind) => setInspect(next);
  const onRefresh = () => {
    refresh();
    setRefreshKey((key) => key + 1);
  };

  if (!isAdminMode) {
    return (
      <div className="flex flex-col w-full h-full p-4">
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          The admin console is disabled in this build.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full gap-4 p-2 md:p-4">
      <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white p-4 md:p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[14px] font-[600] text-[#111]">
            {target ? `Roles on the ${target.labels.contractNoun}` : 'Roles'}
          </div>
          <div className="text-[12px] text-[rgba(0,0,0,0.5)] mt-0.5 break-all">
            {target ? (
              <>
                {target.labels.contractNoun} <span className="font-mono">{target.contractId || 'not configured'}</span> on{' '}
                {target.networkId}. Read from the contract&apos;s on-chain state.
              </>
            ) : (
              'No contract is configured for this console.'
            )}
          </div>
          {target?.kind === 'agglayer' && (
            <div className="text-[12px] text-[rgba(0,0,0,0.5)] mt-1">
              FAUCET_ADMIN is not a bridge role: each bridged-token faucet carries its own ADMIN role.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {configured.length > 1 && (
            <select
              aria-label="Contract"
              value={kind ?? ''}
              onChange={(e) => select(e.target.value as AdminTargetKind)}
              className="h-9 px-2 rounded-[8px] border border-[rgba(0,0,0,0.12)] text-[12px] font-[500] text-[#111] bg-white"
            >
              {configured.map((t) => (
                <option key={t.kind} value={t.kind}>
                  {t.labels.contractShort}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="h-9 px-3 rounded-[8px] border border-[rgba(0,0,0,0.12)] text-[12px] font-[500] text-[#111] hover:bg-gray-50 transition-colors shrink-0"
          >
            Refresh
          </button>
        </div>
      </div>

      {target && state.status === 'idle' ? (
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          Connect a multisig or Bread to read this contract&apos;s roles.
        </div>
      ) : target ? (
        <RoleHolders key={`${refreshKey}:${target.kind}`} target={target} bytesState={bytesState} />
      ) : (
        <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
          Not configured.
        </div>
      )}
    </div>
  );
}
