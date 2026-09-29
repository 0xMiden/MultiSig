'use client';

import { useEffect, useState } from 'react';
import { getFaucetDecimals } from '@/lib/tokenAmounts';

type FaucetDecimals =
  | { status: 'idle' | 'loading'; decimals: null; error: null }
  | { status: 'ready'; decimals: number; error: null }
  | { status: 'error'; decimals: null; error: string };

const IDLE: FaucetDecimals = { status: 'idle', decimals: null, error: null };

/** Decimals of the selected faucet; amounts must not be scaled until `ready`. */
export function useFaucetDecimals(faucetId: string): FaucetDecimals {
  const [state, setState] = useState<FaucetDecimals>(IDLE);

  useEffect(() => {
    const id = faucetId.trim();
    if (!id) {
      setState(IDLE);
      return;
    }
    let cancelled = false;
    setState({ status: 'loading', decimals: null, error: null });
    getFaucetDecimals(id).then(
      (decimals) => { if (!cancelled) setState({ status: 'ready', decimals, error: null }); },
      (err: unknown) => {
        if (!cancelled) setState({ status: 'error', decimals: null, error: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => { cancelled = true; };
  }, [faucetId]);

  return state;
}
