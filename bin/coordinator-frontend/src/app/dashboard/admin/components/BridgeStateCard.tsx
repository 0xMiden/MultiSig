'use client';

import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { useBridgeState } from '@/hooks/useBridgeState';
import { PausePill } from './PauseStatus';
import type { AdminTargetProfile } from '@/lib/admin/target';

/**
 * Paused flag and holder counts for the bridge, at the top of the AggLayer console; a read failure
 * shows as an alert. The PAUSED banner itself is `PauseStatusBanner`, shared with the USDCx tab.
 */
export function BridgeStateCard({ faucetBytesState, target }: { faucetBytesState: FaucetBytesState; target: AdminTargetProfile }) {
  const state = useBridgeState(faucetBytesState, target);
  if (!state) return null;
  if (state.status === 'error') {
    return (
      <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 p-4 md:p-5 text-[13px] text-red-700">
        {state.message}
      </div>
    );
  }
  return (
    <>
      <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="text-[14px] font-[600] text-[#111]">Bridge state</div>
          <PausePill faucetBytesState={faucetBytesState} target={target} />
        </div>
        <div className="text-[12px] text-[rgba(0,0,0,0.5)] mb-3">Current on-chain values.</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-[#f9f9f9] px-3 py-2.5">
            <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.5)]">Status</div>
            <div className={`text-[14px] font-[600] mt-0.5 ${state.paused ? 'text-red-700' : 'text-[#1F7A3F]'}`}>
              {state.paused ? 'Paused' : 'Running'}
            </div>
          </div>
          {target.roles.map((role) => (
            <div key={role.symbol} className="rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-[#f9f9f9] px-3 py-2.5">
              <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.5)] font-mono">{role.label}</div>
              <div className="text-[14px] font-[600] text-[#111] mt-0.5">
                {state.holderCounts[role.symbol] ?? 0} holder{(state.holderCounts[role.symbol] ?? 0) === 1 ? '' : 's'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
