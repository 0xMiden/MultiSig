'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMultisig } from '@/contexts/MultisigContext';
import { getAdminTargets } from '@/config/adminConfig';
import { initAdminWasm } from '@/lib/admin/noteBuilders';
import { accountIdHexFromBech32 } from '@/lib/admin/directAction';
import { evaluateRoles } from '@/lib/admin/roles';
import { fetchFaucetBytes } from '@/lib/admin/faucetAccount';
import type { TargetEvaluation } from '@/lib/admin/targetSelection';

/** The per-target contract bytes, as the forms and guardrails consume them. */
export type FaucetBytesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; bytes: Uint8Array };

export type AdminTargetsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; evaluations: TargetEvaluation[] };

/**
 * Reads every configured contract from the node and evaluates the roles of the acting multisig
 * and, when Bread is the active wallet source, of the Bread account. One target failing (private,
 * missing, RPC error) is reported on that target only; it never degrades to "no roles".
 * The contracts are read whenever a Miden client exists, connected or not (the state card and the
 * roles page need no account); a party that is absent has `null` roles. `idle` only without a client.
 */
const QUIET_REREAD_MS = 30_000;

export function useAdminTargets(): { state: AdminTargetsState; refresh: () => void } {
  const { midenClient, multisig, walletSource, midenWalletSession, syncingState, accountNonce } = useMultisig();
  const [state, setState] = useState<AdminTargetsState>({ status: 'idle' });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Quiet re-reads keep the current state on screen until the new one arrives, so the page
  // does not flash "Detecting roles" for a routine check. The contracts change under this tab:
  // another admin or a Bread account can pause, grant or revoke at any time, and the acting
  // multisig's own executes land after the first read. So: after every Sync, whenever the acting
  // multisig's nonce moves (it executed something), and every 30 s while the tab is visible.
  const quiet = useRef(false);
  const [quietTick, setQuietTick] = useState(0);
  const reread = useCallback(() => {
    quiet.current = true;
    setQuietTick((t) => t + 1);
  }, []);
  const wasSyncing = useRef(syncingState);
  useEffect(() => {
    if (wasSyncing.current && !syncingState) reread();
    wasSyncing.current = syncingState;
  }, [syncingState, reread]);
  const lastNonce = useRef(accountNonce);
  useEffect(() => {
    if (lastNonce.current !== null && accountNonce !== null && accountNonce !== lastNonce.current) reread();
    lastNonce.current = accountNonce;
  }, [accountNonce, reread]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') reread();
    }, QUIET_REREAD_MS);
    return () => clearInterval(timer);
  }, [reread]);

  const breadAddress =
    walletSource === 'miden-wallet' && midenWalletSession.connected ? (midenWalletSession.address ?? null) : null;

  useEffect(() => {
    if (!midenClient) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    const silent = quiet.current;
    quiet.current = false;
    if (!silent) setState({ status: 'loading' });
    (async () => {
      await initAdminWasm();
      const breadAccountId = breadAddress ? accountIdHexFromBech32(breadAddress) : null;
      const evaluations = await Promise.all(
        getAdminTargets().map(async (target): Promise<TargetEvaluation> => {
          try {
            const bytes = await fetchFaucetBytes(midenClient, target.contractId);
            return {
              target,
              status: 'ready',
              bytes,
              roles: multisig ? evaluateRoles(bytes, multisig.account.id().toString(), target) : null,
              breadRoles: breadAccountId ? evaluateRoles(bytes, breadAccountId, target) : null,
              breadAccountId,
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { target, status: 'error', roles: null, breadRoles: null, breadAccountId, message: `Could not read the ${target.labels.contractNoun}: ${message}` };
          }
        }),
      );
      if (!cancelled) setState({ status: 'ready', evaluations });
    })().catch((err) => {
      // initAdminWasm or bech32 parsing failed: every target is unreadable.
      if (cancelled) return;
      const message = err instanceof Error ? err.message : String(err);
      setState({
        status: 'ready',
        evaluations: getAdminTargets().map((target) => ({ target, status: 'error', roles: null, breadRoles: null, breadAccountId: null, message })),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [midenClient, multisig, breadAddress, tick, quietTick]);

  return { state, refresh };
}

/** The active target's bytes in the shape the action forms and guardrails take. */
export function bytesStateOf(active: TargetEvaluation | null, state: AdminTargetsState): FaucetBytesState {
  if (state.status !== 'ready' || !active) return { status: 'loading' };
  if (active.status === 'error') return { status: 'error', message: active.message ?? 'unreadable' };
  return { status: 'ready', bytes: active.bytes! };
}
