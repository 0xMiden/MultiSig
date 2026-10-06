'use client';

import { useEffect, useState } from 'react';
import type { FaucetBytesState } from './useFaucetAccountBytes';
import { initAdminWasm, readCurrentMinBurn, readCurrentMaxSupply } from '@/lib/admin/noteBuilders';

export interface FaucetConfig {
  minBurn: string;
  maxSupply: string;
}

/**
 * Reads the faucet's current on-chain config (min burn, max supply) from the fetched account
 * bytes, for display next to the "new value" inputs. Returns `null` until the bytes are ready and
 * the admin WASM has initialized; never throws (a read failure just leaves it `null`).
 */
export function useFaucetConfig(state: FaucetBytesState): FaucetConfig | null {
  const [config, setConfig] = useState<FaucetConfig | null>(null);

  useEffect(() => {
    if (state.status !== 'ready') {
      setConfig(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await initAdminWasm();
        const minBurn = readCurrentMinBurn(state.bytes).toString();
        const maxSupply = readCurrentMaxSupply(state.bytes).toString();
        if (!cancelled) setConfig({ minBurn, maxSupply });
      } catch {
        if (!cancelled) setConfig(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  return config;
}
