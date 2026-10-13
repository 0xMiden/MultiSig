'use client';

import { useAdminTarget } from '@/contexts/AdminTargetContext';

/**
 * One tab per configured contract (USDCx faucet, AggLayer bridge). The chosen tab is the one
 * console every admin page shows; it is rendered only when more than one contract is configured.
 */
export function AdminTargetSwitcher() {
  const { configured, shownTarget, selectKind } = useAdminTarget();
  if (configured.length < 2) return null;
  return (
    <div className="flex items-center gap-1 border-b border-[rgba(0,0,0,0.08)]" role="tablist" aria-label="Admin console">
      {configured.map((t) => {
        const selected = t.kind === shownTarget?.kind;
        return (
          <button
            key={t.kind}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => selectKind(t.kind)}
            className={`-mb-px px-4 py-2.5 text-[13px] font-[500] border-b-2 transition-colors ${
              selected ? 'border-[#FF5500] text-[#FF5500]' : 'border-transparent text-[rgba(0,0,0,0.55)] hover:text-[#111]'
            }`}
          >
            {t.labels.contractShort}
          </button>
        );
      })}
    </div>
  );
}
