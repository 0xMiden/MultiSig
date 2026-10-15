'use client';

import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { useBridgeState } from '@/hooks/useBridgeState';
import { pauseStatus } from '@/lib/admin/bridgeState';
import type { AdminTargetProfile } from '@/lib/admin/target';

/**
 * The shown contract's pause status (USDCx faucet or AggLayer bridge). A paused contract gets a
 * full-width red PAUSED banner; a running one shows nothing here (the state card carries a quiet
 * pill). Nothing while the state is unread or failed to read: never "Running" by default.
 */
export function PauseStatusBanner({ faucetBytesState, target }: { faucetBytesState: FaucetBytesState; target: AdminTargetProfile }) {
  const pause = pauseStatus(useBridgeState(faucetBytesState, target), target);
  if (!pause?.paused) return null;
  return (
    <div
      role="alert"
      className="rounded-[10px] border-2 border-red-700 bg-red-600 text-white p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5"
    >
      <div className="text-[32px] md:text-[40px] leading-none font-[800] tracking-[0.12em]">{pause.headline}</div>
      <div className="text-[13px] md:text-[14px] font-[500] text-white/90">{pause.detail}</div>
    </div>
  );
}

/** PAUSED / Running pill for a state card title; nothing while unread. */
export function PausePill({ faucetBytesState, target }: { faucetBytesState: FaucetBytesState; target: AdminTargetProfile }) {
  const pause = pauseStatus(useBridgeState(faucetBytesState, target), target);
  if (!pause) return null;
  return (
    <span
      className={`text-[11px] font-[700] px-2 py-0.5 rounded-full tracking-wide ${
        pause.paused ? 'bg-red-600 text-white' : 'bg-[#28A857]/10 text-[#1F7A3F]'
      }`}
    >
      {pause.headline}
    </span>
  );
}
