'use client';

import { useAdminTarget } from '@/contexts/AdminTargetContext';
import { profileOf } from '@/lib/admin/target';

/** USDCx / AggLayer chips; rendered only when the acting accounts hold roles on more than one contract. */
export function AdminTargetSwitcher() {
  const { switchable, activeKind, setActiveKind } = useAdminTarget();
  if (switchable.length < 2) return null;
  return (
    <div className="flex items-center gap-1 rounded-full border border-[rgba(0,0,0,0.12)] p-0.5" role="tablist" aria-label="Admin console">
      {switchable.map((kind) => (
        <button
          key={kind}
          type="button"
          role="tab"
          aria-selected={kind === activeKind}
          onClick={() => setActiveKind(kind)}
          className={`text-[11px] font-[500] px-2.5 py-1 rounded-full transition-colors ${kind === activeKind ? 'bg-[#FF5500] text-white' : 'text-[#111] hover:bg-[#FF5500]/10'}`}
        >
          {profileOf(kind).labels.contractShort}
        </button>
      ))}
    </div>
  );
}
