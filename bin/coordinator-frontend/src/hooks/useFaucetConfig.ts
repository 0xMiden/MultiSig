'use client';

import { useEffect, useState } from 'react';
import type { FaucetBytesState } from './useAdminTargets';
import {
  initAdminWasm,
  readCurrentMinBurn,
  readCurrentMaxSupply,
  readCurrentTokenSupply,
  readEnabledAttesters,
} from '@/lib/admin/noteBuilders';

export interface FaucetConfig {
  minBurn: string;
  maxSupply: string;
  /**
   * Base units already issued. A new max supply must not be set below this (the faucet rejects
   * `set_max_supply` with "new max supply is less than current token supply"), so the Set max
   * supply form validates against it before a proposal is created.
   */
  tokenSupply: string;
  /** Hex commitments of the attesters currently enabled on the faucet (the `set_attester` state). */
  attesters: string[];
}

/**
 * Reads the faucet's current on-chain config (min burn, max supply, token supply, enabled attesters) from the fetched
 * account bytes, for display next to the "new value" inputs and to validate them. Returns `null`
 * until the bytes are ready and the admin WASM has initialized; never throws (a read failure just
 * leaves it `null`).
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
        const tokenSupply = readCurrentTokenSupply(state.bytes).toString();
        const attesters = readEnabledAttesters(state.bytes);
        if (!cancelled) setConfig({ minBurn, maxSupply, tokenSupply, attesters });
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
