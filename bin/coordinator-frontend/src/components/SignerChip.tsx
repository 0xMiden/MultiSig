"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useMultisig } from "@/contexts/MultisigContext";
import { copyToClipboard, truncateHex } from "@/lib/helpers";

const SOURCE_LABEL: Record<string, string> = {
  ledger: "Ledger",
  para: "Para",
  "miden-wallet": "Miden Wallet",
  local: "Local key",
};

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg aria-hidden className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg aria-hidden className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

/**
 * The connected signer's public key commitment, top right on every page: the
 * value a co-signer sends to the account creator. The icon copies it in one
 * click; the chip opens the full value and, for Ledger, the address and path
 * it belongs to (each Ledger address has its own commitment).
 */
export function SignerChip() {
  const { walletSource, activeCommitment, activeScheme, ledger } = useMultisig();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  if (!activeCommitment) return null;
  const source = SOURCE_LABEL[walletSource] ?? walletSource;
  const ledgerAccount = walletSource === "ledger" ? ledger.selected : null;

  const copy = (value: string, label: string) => copyToClipboard(value, () => {
    setCopied(label);
    setTimeout(() => setCopied((current) => (current === label ? null : current)), 1500);
    toast.success(`${label} copied`);
  });

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center h-8 rounded-[8px] border border-[rgba(0,0,0,0.12)] bg-white text-[11px] font-[500] overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          title={`Public key commitment: ${activeCommitment}`}
          className="flex items-center gap-2 h-full pl-3 pr-2 hover:bg-[rgba(0,0,0,0.03)]"
        >
          <span className="text-[#FF5500] uppercase">{source}</span>
          <span className="font-mono text-[#111]">{truncateHex(activeCommitment, 6, 4)}</span>
        </button>
        <button
          type="button"
          onClick={() => copy(activeCommitment, "Public key commitment")}
          aria-label="Copy public key commitment"
          title="Copy public key commitment"
          className="flex items-center justify-center h-full w-8 border-l border-[rgba(0,0,0,0.12)] text-[rgba(0,0,0,0.55)] hover:bg-[rgba(0,0,0,0.03)] hover:text-[#FF5500]"
        >
          <CopyIcon done={copied === "Public key commitment"} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[340px] rounded-[8px] border border-[rgba(0,0,0,0.12)] bg-white p-3 shadow-lg flex flex-col gap-3 font-sans">
          <div className="text-[10px] font-[600] uppercase tracking-wide text-[rgba(0,0,0,0.5)]">
            Your signer · {source} · {activeScheme.toUpperCase()}
          </div>
          <Field label="Public key commitment" value={activeCommitment} copied={copied} onCopy={copy}
            hint="Share this with the account creator so they can add you as a signer." />
          {ledgerAccount && (
            <Field label="Ledger address" value={ledgerAccount.address} copied={copied} onCopy={copy}
              hint={`Path ${ledgerAccount.path}. Reconnect this same address to sign with this commitment.`} />
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, hint, copied, onCopy }: {
  label: string; value: string; hint?: string; copied: string | null; onCopy: (value: string, label: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-[500] text-[#111]">{label}</span>
        <button
          type="button"
          onClick={() => onCopy(value, label)}
          className="flex items-center gap-1 text-[11px] font-[500] text-[#FF5500] hover:text-[#E64A00]"
        >
          <CopyIcon done={copied === label} /> {copied === label ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="break-all rounded-[4px] bg-[rgba(0,0,0,0.04)] px-2 py-1.5 font-mono text-[11px] leading-snug text-[#111]">{value}</code>
      {hint && <span className="text-[10px] text-[rgba(0,0,0,0.5)]">{hint}</span>}
    </div>
  );
}
