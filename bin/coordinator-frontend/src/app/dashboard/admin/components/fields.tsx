'use client';

import { useMemo } from 'react';
import { normalizeAccountId } from '@/lib/admin/validation';
import { toBech32Address, truncateHex } from '@/lib/helpers';
import { BECH32_PREFIX } from '@/lib/midenNetwork';

/** Shared field styling/wrapper for admin forms, matching `SendModal`'s input conventions. */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-[500] text-[rgba(0,0,0,0.5)]">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-[rgba(0,0,0,0.4)]">{hint}</div>}
    </div>
  );
}

export const textInputClass =
  'w-full h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] px-3 font-mono text-[12px] text-[#111] placeholder:text-[rgba(0,0,0,0.3)] focus:outline-hidden focus:ring-1 focus:ring-[#FF5500] bg-white';

export const selectClass =
  'w-full h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] px-3 text-[12px] text-[#111] focus:outline-hidden focus:ring-1 focus:ring-[#FF5500] bg-white';

export const readOnlyInputClass =
  'w-full h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] px-3 font-mono text-[12px] text-[rgba(0,0,0,0.5)] bg-[#f5f5f5] cursor-not-allowed';

/**
 * An account-id input that accepts a hex id OR a bech32 address (plain or the full
 * `<addr>_<routing>` form) and shows, live, what the entry resolves to — so the user
 * can confirm a pasted address is recognized before submitting. The parent still calls
 * `normalizeAccountId` in its own `buildArgs`; this only mirrors that resolution for feedback.
 */
export function AccountIdField({
  label,
  value,
  onChange,
  networkId,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  networkId: string;
}) {
  const resolved = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const hex = normalizeAccountId(trimmed, networkId);
      return { ok: true as const, hex, bech32: toBech32Address(hex) };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Invalid account ID' };
    }
  }, [value, networkId]);

  const prefix = (BECH32_PREFIX as Record<string, string>)[networkId];
  const placeholder = prefix ? `0x… or ${prefix}1…` : '0x… or bech32 address';

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-[500] text-[rgba(0,0,0,0.5)]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={textInputClass}
      />
      {resolved === null ? (
        <div className="text-[11px] text-[rgba(0,0,0,0.4)]">Accepts a hex account ID or a bech32 address.</div>
      ) : resolved.ok ? (
        <div className="text-[11px] text-[#1F7A3F] font-mono break-all">
          ↳ {truncateHex(resolved.hex, 10, 6)}
          {resolved.bech32 ? ` · ${truncateHex(resolved.bech32, 10, 6)}` : ''}
        </div>
      ) : (
        <div className="text-[11px] text-red-600">{resolved.message}</div>
      )}
    </div>
  );
}

/** A boolean on/off control matching `SendModal`'s "Send Privately" toggle. */
export function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between rounded-[8px] border border-[rgba(0,0,0,0.08)] px-3 h-10 text-left"
    >
      <span className="text-[12px] font-[500] text-[#111]">{label}</span>
      <span className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-[#FF5500]' : 'bg-[rgba(0,0,0,0.15)]'}`}>
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : ''}`}
        />
      </span>
    </button>
  );
}
