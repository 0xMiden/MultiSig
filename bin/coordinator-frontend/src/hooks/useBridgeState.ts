'use client';

import { useEffect, useState } from 'react';
import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { initAdminWasm, readIsPaused } from '@/lib/admin/noteBuilders';
import { listRoleHolders } from '@/lib/admin/roles';
import { bridgeStateFromBytes, type BridgeStateResult } from '@/lib/admin/bridgeState';
import type { AdminTargetProfile } from '@/lib/admin/target';

/** The bridge's state from its account bytes (see `bridgeStateFromBytes`); `null` until the bytes are ready. */
export function useBridgeState(state: FaucetBytesState, target: AdminTargetProfile): BridgeStateResult | null {
  const [value, setValue] = useState<BridgeStateResult | null>(null);
  useEffect(() => {
    if (state.status !== 'ready') {
      setValue(null);
      return;
    }
    let cancelled = false;
    (async () => {
      let result: BridgeStateResult;
      try {
        await initAdminWasm();
        result = bridgeStateFromBytes(state.bytes, target, { listRoleHolders, readIsPaused });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result = { status: 'error', message: `Could not read the ${target.labels.contractNoun}'s state: ${message}` };
      }
      if (!cancelled) setValue(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [state, target]);
  return value;
}
