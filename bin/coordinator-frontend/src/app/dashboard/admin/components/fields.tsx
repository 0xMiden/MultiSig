'use client';

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
