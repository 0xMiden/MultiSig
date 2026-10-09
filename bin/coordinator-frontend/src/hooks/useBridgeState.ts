'use client';

import { useEffect, useState } from 'react';
import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { initAdminWasm, readIsPaused } from '@/lib/admin/noteBuilders';
import { listRoleHolders } from '@/lib/admin/roles';
import type { AdminTargetProfile } from '@/lib/admin/target';

export interface BridgeState {
  paused: boolean;
  /** Holder count per on-chain role symbol. */
  holderCounts: Record<string, number>;
}

/** The bridge's paused flag and role holder counts from its account bytes; `null` until readable. */
export function useBridgeState(state: FaucetBytesState, target: AdminTargetProfile): BridgeState | null {
  const [value, setValue] = useState<BridgeState | null>(null);
  useEffect(() => {
    if (state.status !== 'ready') {
      setValue(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await initAdminWasm();
        const holders = listRoleHolders(state.bytes, target);
        const holderCounts = Object.fromEntries(Object.entries(holders).map(([role, ids]) => [role, ids.length]));
        if (!cancelled) setValue({ paused: readIsPaused(state.bytes), holderCounts });
      } catch {
        if (!cancelled) setValue(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, target]);
  return value;
}
