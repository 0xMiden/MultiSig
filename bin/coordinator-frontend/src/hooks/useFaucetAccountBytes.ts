'use client';

import { useEffect, useState } from 'react';
import { useMultisig } from '@/contexts/MultisigContext';
import { getAdminConfig } from '@/config/adminConfig';
import { fetchFaucetBytes } from '@/lib/admin/faucetAccount';

export type FaucetBytesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; bytes: Uint8Array };

const LOADING: FaucetBytesState = { status: 'loading' };

/**
 * The faucet's serialized account bytes, as `runGuardrails` needs them. Shares the same
 * fetch-with-fallback logic as `useFaucetRoles` (via `fetchFaucetBytes`) but is kept as its own
 * hook/state rather than widening `useFaucetRoles`'s return shape, since that hook's contract is
 * already consumed elsewhere as `{status, roles}`.
 */
export function useFaucetAccountBytes(): FaucetBytesState {
  const { midenClient } = useMultisig();
  const [state, setState] = useState<FaucetBytesState>(LOADING);

  useEffect(() => {
    if (!midenClient) {
      setState(LOADING);
      return;
    }

    let cancelled = false;
    setState(LOADING);

    (async () => {
      try {
        const { faucetId } = getAdminConfig();
        if (!faucetId) throw new Error('NEXT_PUBLIC_USDCX_FAUCET_ID is not set');
        const bytes = await fetchFaucetBytes(midenClient, faucetId);
        if (!cancelled) setState({ status: 'ready', bytes });
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setState({ status: 'error', message: `Could not read faucet state for guardrails: ${message}` });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [midenClient]);

  return state;
}
