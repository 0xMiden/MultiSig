'use client';

import { GUARDIAN_ENDPOINTS } from '@/config/psm';

/**
 * The Guardians this deployment can reach (NEXT_PUBLIC_GUARDIAN_ENDPOINT plus
 * NEXT_PUBLIC_GUARDIAN_ENDPOINTS), as one-click choices for the Guardian field.
 * Hidden when there is nothing to choose between.
 */
export function GuardianChoices({ current, onPick }: { current: string; onPick: (url: string) => void }) {
  if (GUARDIAN_ENDPOINTS.length < 2) return null;
  return (
    <div className="mb-2">
      <div className="text-[10px] text-gray-500 mb-1">Available Guardians</div>
      <div className="flex flex-col gap-1">
        {GUARDIAN_ENDPOINTS.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => onPick(url)}
            aria-pressed={current.trim() === url}
            className={`text-left text-[10px] px-2 py-1 border rounded-sm break-all ${
              current.trim() === url ? 'border-[#FF5500] text-[#FF5500]' : 'border-gray-200 hover:border-gray-400'
            }`}
          >
            {url}
          </button>
        ))}
      </div>
    </div>
  );
}
