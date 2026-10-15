"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SessionEndReason } from "@openzeppelin/guardian-client";
import { useMultisig } from "@/contexts/MultisigContext";
import { copyToClipboard, truncateHex } from "@/lib/helpers";
import { lookupClientFor, lookupSignerAccounts, type SignerAccount } from "@/lib/signerAccounts";

const SOURCE_LABEL: Record<string, string> = {
  ledger: "Ledger",
  para: "Para",
  "miden-wallet": "Bread",
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
  const { walletSource, activeCommitment, activeScheme, ledger, guardianSession, startGuardianSession, guardianUrl } = useMultisig();
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
          <SessionDot state={guardianSession} />
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
          {walletSource === "ledger" && ledger.signer && (
            <SignerAccounts signer={ledger.signer} guardianUrl={guardianUrl} copied={copied} onCopy={copy} />
          )}
          {guardianSession.phase !== "off" && (
            <SessionStatus state={guardianSession} onStart={() => void startGuardianSession()} />
          )}
        </div>
      )}
    </div>
  );
}

type SessionState = ReturnType<typeof useMultisig>["guardianSession"];

/** Green while the session signs Guardian requests, amber while it starts or after it stopped. */
function SessionDot({ state }: { state: SessionState }) {
  if (state.phase === "off" || state.phase === "unsupported") return null;
  const active = state.phase === "active";
  const busy = state.phase === "starting" || state.phase === "resuming";
  return (
    <span
      aria-label={active ? "Guardian session active" : busy ? "Guardian session starting" : "No Guardian session"}
      title={active ? "Guardian session active" : busy ? "Guardian session starting" : "No Guardian session: Guardian requests ask the wallet"}
      className={`h-1.5 w-1.5 rounded-full ${active ? "bg-green-600" : busy ? "bg-amber-400 animate-pulse" : "bg-amber-500"}`}
    />
  );
}

const ENDED: Record<SessionEndReason, string> = {
  expired: "It expired.",
  revoked: "It was ended elsewhere (another tab or device).",
  rejected: "Guardian no longer accepts it.",
  logout: "It was ended.",
};

/** The expiry in local time, with the date when it is not today. */
function untilText(expiresAt: number): string {
  const at = new Date(expiresAt * 1000);
  const sameDay = at.toDateString() === new Date().toDateString();
  return sameDay
    ? at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : at.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SessionStatus({ state, onStart }: { state: SessionState; onStart: () => void }) {
  const text =
    state.phase === "active" ? `Active until ${untilText(state.expiresAt)}: Guardian requests do not ask your wallet.`
    : state.phase === "resuming" ? "Resuming this wallet's session…"
    : state.phase === "starting" ? "Starting: approve it in your wallet."
    : state.phase === "ended" ? `${ENDED[state.reason]} Guardian requests ask your wallet again.`
    : state.phase === "failed" ? state.message
    : state.phase === "unsupported" ? "This Guardian does not offer sessions: Guardian requests ask your wallet."
    : "";
  const canStart = state.phase === "ended" || state.phase === "failed";
  return (
    <div className="flex flex-col gap-1 border-t border-[rgba(0,0,0,0.08)] pt-2">
      <span className="text-[11px] font-[500] text-[#111]">Guardian session</span>
      <span className="text-[11px] text-[rgba(0,0,0,0.6)]">{text}</span>
      {canStart && (
        <button type="button" onClick={onStart}
          className="self-start text-[11px] font-[500] text-[#FF5500] underline underline-offset-2 hover:text-[#E64A00]">
          Start session
        </button>
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

type SignerAccountsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; accounts: SignerAccount[] }
  | { status: "error"; message: string };

/**
 * The multisig accounts this signer cosigns, from Guardian's signer lookup
 * (one lookup approval on the device), each with its id and address to copy:
 * the values another admin needs to grant this signer's account a role.
 */
function SignerAccounts({ signer, guardianUrl, copied, onCopy }: {
  signer: Parameters<typeof lookupSignerAccounts>[1]; guardianUrl: string; copied: string | null; onCopy: (value: string, label: string) => void;
}) {
  const [state, setState] = useState<SignerAccountsState>({ status: "idle" });
  // Another Ledger address is another signer: its accounts are not these.
  useEffect(() => { setState({ status: "idle" }); }, [signer]);

  const find = async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", accounts: await lookupSignerAccounts(lookupClientFor(guardianUrl), signer) });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-[rgba(0,0,0,0.08)] pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-[500] text-[#111]">Accounts this signer cosigns</span>
        <button
          type="button"
          disabled={state.status === "loading"}
          onClick={() => void find()}
          className="text-[11px] font-[500] text-[#FF5500] hover:text-[#E64A00] disabled:opacity-50"
        >
          {state.status === "loading" ? "Approve the lookup on Ledger…" : state.status === "ready" ? "Refresh" : "Find on Guardian"}
        </button>
      </div>
      {state.status === "idle" && (
        <span className="text-[10px] text-[rgba(0,0,0,0.5)]">Guardian lists the multisig accounts this commitment signs for: one lookup approval on the device.</span>
      )}
      {state.status === "error" && <span role="alert" className="text-[10px] text-red-700">{state.message}</span>}
      {state.status === "ready" && state.accounts.length === 0 && (
        <span className="text-[10px] text-[rgba(0,0,0,0.5)]">Guardian lists no account for this signer.</span>
      )}
      {state.status === "ready" && state.accounts.map((account, index) => (
        <div key={account.accountId} className="flex flex-col gap-2">
          <Field label={state.accounts.length > 1 ? `Account ${index + 1} ID` : "Account ID"} value={account.accountId} copied={copied} onCopy={onCopy} />
          {account.address && (
            <Field label={state.accounts.length > 1 ? `Account ${index + 1} address` : "Address"} value={account.address} copied={copied} onCopy={onCopy} />
          )}
        </div>
      ))}
    </div>
  );
}
