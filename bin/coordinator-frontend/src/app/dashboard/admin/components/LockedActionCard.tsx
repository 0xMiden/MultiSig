'use client';

import type { AdminAction } from '@/lib/admin/recipe';
import { ACTION_INFO, ACTION_ROLE } from '@/lib/admin/roles';

/**
 * An admin action the acting multisig cannot use, shown so the full set of actions is visible
 * up front. It has no inputs and no submit: it names the action and the role that unlocks it.
 */
export function LockedActionCard({ action }: { action: AdminAction }) {
  const info = ACTION_INFO[action];
  const role = ACTION_ROLE[action];

  return (
    <div
      aria-disabled="true"
      className="rounded-[10px] border border-dashed border-[rgba(0,0,0,0.12)] bg-[rgba(0,0,0,0.02)] p-4 md:p-5 flex flex-col gap-3"
    >
      <div className="opacity-55">
        <div className="text-[14px] font-[600] text-[#111]">{info.title}</div>
        <div className="text-[12px] text-[rgba(0,0,0,0.5)] mt-0.5">{info.description}</div>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-[500] text-[rgba(0,0,0,0.55)]">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        Requires the <span className="font-mono">{role}</span> role
      </div>
    </div>
  );
}
