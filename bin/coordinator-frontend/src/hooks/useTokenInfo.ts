'use client';

import { useEffect, useState } from 'react';
import { getTokenInfo, type TokenInfo } from '@/lib/tokenAmounts';

export type TokenInfoState =
  | { status: 'loading'; info: null; error: null }
  | { status: 'ready'; info: TokenInfo; error: null }
  | { status: 'error'; info: null; error: string };

/** A faucet's decimals and symbol from its on-chain metadata. */
export function useTokenInfo(faucetId: string): TokenInfoState {
  const [state, setState] = useState<TokenInfoState>({ status: 'loading', info: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', info: null, error: null });
    getTokenInfo(faucetId).then(
      (info) => { if (!cancelled) setState({ status: 'ready', info, error: null }); },
      (err: unknown) => {
        if (!cancelled) setState({ status: 'error', info: null, error: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => { cancelled = true; };
  }, [faucetId]);

  return state;
}
