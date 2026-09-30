"use client";

import React, { useEffect, useState } from "react";
import { msUntilUnlockable } from "@/lib/pendingCandidate";
import { ledgerNotice } from "@/lib/ledgerNotice";
import type { AccountLock, MultisigContextValue } from "@/contexts/MultisigContext";
import { useMultisig } from "@/contexts/MultisigContext";

/**
 * Surfaces MultisigContext load/sync failures on the dashboard.
 *
 * Previously `error` was only rendered on the login page, so a failed
 * auto-load left the dashboard showing an account with "0 of 0" signers and
 * no explanation at all. The second case below catches exactly that state:
 * an account is loaded, but `detectedConfig` — the sole source of signers,
 * threshold and balances — never arrived.
 */
const AccountStatusBanner = () => {
  const {
    error,
    pendingCandidateWarning,
    lockedCandidate,
    releasingCandidate,
    unlockAccount,
    executingProposal,
    accountFunding,
    multisig,
    detectedConfig,
    loadingAccount,
    registeringOnGuardian,
    guardianRegistrationRequired,
    syncingState,
    handleSync,
    retryGuardianRegistration,
    retryAccountFunding,
    walletSource,
    ledger,
    handleLoad,
  } = useMultisig();

  const fundingBusy = accountFunding.phase === "registering" || accountFunding.phase === "waiting-for-note";
  const busy = loadingAccount || registeringOnGuardian || syncingState || fundingBusy || releasingCandidate || Boolean(executingProposal);
  const configMissing = Boolean(multisig) && !detectedConfig && !busy;
  // Auto-load skips Ledger and an unplug unloads the account, so a Ledger user
  // can land here with nothing loaded: offer the way back from the dashboard.
  const ledgerNeeded = walletSource === "ledger" && Boolean(ledger) && (!ledger.signer || !multisig || Boolean(ledger.error));

  if (!error && !pendingCandidateWarning && !lockedCandidate && !configMissing && !ledgerNeeded && accountFunding.phase === "idle") return null;

  const retry = () => {
    const operation = guardianRegistrationRequired ? retryGuardianRegistration : handleSync;
    operation().catch(() => {
      /* handleSync already reports failures through `error` */
    });
  };

  return (
    <div className="w-full flex flex-col gap-2 mb-4">
      {ledgerNeeded && (
        <LedgerNotice ledger={ledger} accountLoaded={Boolean(multisig)} loading={loadingAccount} onLoad={handleLoad} />
      )}

      {accountFunding.phase !== "idle" && (
        <div
          role={accountFunding.phase === "error" ? "alert" : "status"}
          className="w-full rounded-[8px] border border-[#FF550033] bg-[#FF55000A] px-3 py-2.5 flex flex-row items-start justify-between gap-3"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-[600] text-[#C2410C]">
              {accountFunding.phase === "registering" && "Registering account on devnet"}
              {accountFunding.phase === "waiting-for-note" && "Waiting for devnet funding"}
              {accountFunding.phase === "funding-available" && "Funding note ready"}
              {accountFunding.phase === "error" && "Account funding needs attention"}
            </span>
            <span className="text-[12px] font-[400] text-[#9A3412] wrap-break-word">
              {accountFunding.phase === "registering" && "The node is registering this account and preparing its initial funding note."}
              {accountFunding.phase === "waiting-for-note" && "The account is registered. Waiting for its funding note to appear in Receive Funds."}
              {accountFunding.phase === "funding-available" && "Open Receive Funds, create a proposal for this note, then collect signatures to deploy and fund the account."}
              {accountFunding.phase === "error" && accountFunding.message}
            </span>
          </div>
          {accountFunding.phase === "error" && (
            <button
              type="button"
              onClick={() => void retryAccountFunding()}
              disabled={busy}
              className="min-h-8 shrink-0 text-[12px] font-[500] text-[#9A3412] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5500] disabled:opacity-50"
            >
              Retry funding
            </button>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="w-full rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5 flex flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-[600] text-red-700">
              Account error
            </span>
            <span className="text-[12px] font-[400] text-red-600 wrap-break-word">
              {error}
            </span>
          </div>
          <button
            onClick={retry}
            disabled={busy}
            className="min-h-8 shrink-0 text-[12px] font-[500] text-red-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50"
          >
            {busy ? "Retrying…" : guardianRegistrationRequired ? "Retry Guardian registration" : "Retry"}
          </button>
        </div>
      )}

      {configMissing && (
        <div role="status" className="w-full rounded-[8px] border border-[#FF550033] bg-[#FF55000A] px-3 py-2.5 flex flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-[600] text-[#FF5500]">
              Account details unavailable
            </span>
            <span className="text-[12px] font-[400] text-[#FF5500]">
              The account loaded, but its signers, threshold and balances
              could not be read.{" "}
              {error || pendingCandidateWarning
                ? "The reason is shown above."
                : "Retry to read them again."}
            </span>
          </div>
          <button
            onClick={retry}
            disabled={busy}
            className="min-h-8 shrink-0 text-[12px] font-[500] text-[#FF5500] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5500] disabled:opacity-50"
          >
            {busy ? "Retrying…" : guardianRegistrationRequired ? "Retry Guardian registration" : "Retry"}
          </button>
        </div>
      )}

      {lockedCandidate ? (
        <LockNotice
          lock={lockedCandidate}
          message={pendingCandidateWarning}
          busy={busy}
          releasing={releasingCandidate}
          onUnlock={() => void unlockAccount()}
        />
      ) : pendingCandidateWarning && (
        <div role="status" className="w-full rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2.5">
          <span className="text-[12px] font-[400] text-amber-700">{pendingCandidateWarning}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Ledger connection state on the dashboard: the last Ledger error, and the
 * next step (connect the device, or load the account with it).
 */
function LedgerNotice({ ledger, accountLoaded, loading, onLoad }: {
  ledger: MultisigContextValue["ledger"];
  accountLoaded: boolean;
  loading: boolean;
  onLoad: MultisigContextValue["handleLoad"];
}) {
  const [savedId] = useState(() => {
    try { return localStorage.getItem("currentWalletId"); } catch { return null; }
  });
  if (ledger.open) return null;

  const notice = ledgerNotice({
    connected: Boolean(ledger.signer),
    accountLoaded,
    savedId,
    address: ledger.selected?.address ?? null,
    error: ledger.error,
  });
  const run = {
    connect: ledger.show,
    options: ledger.show,
    load: () => { if (savedId) onLoad(savedId, "ecdsa").catch(() => { /* reported through `error` */ }); },
  };
  const action = notice.action === "choose" ? null : notice.action;
  const label = action === "load" && loading ? "Loading…" : notice.label;
  const title = notice.title;
  const text = notice.text;

  return (
    <div role={ledger.error ? "alert" : "status"} className="w-full rounded-[8px] border border-[#FF550033] bg-[#FF55000A] px-3 py-2.5 flex flex-row items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[12px] font-[600] text-[#C2410C]">{title}</span>
        <span className="text-[12px] font-[400] text-[#9A3412] wrap-break-word">{text}</span>
      </div>
      {action ? (
        <button
          type="button"
          onClick={run[action]}
          disabled={loading || ledger.busy}
          className="min-h-8 shrink-0 rounded-[6px] bg-[#FF5500] px-3 text-[12px] font-[500] text-white hover:bg-[#E64A00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5500] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {label}
        </button>
      ) : notice.action === "choose" && (
        <a href="/login" className="min-h-8 shrink-0 inline-flex items-center text-[12px] font-[500] text-[#9A3412] underline underline-offset-2">Choose an account</a>
      )}
    </div>
  );
}


/** The account's Guardian lock, with its age and a live countdown to Unlock. */
function LockNotice({ lock, message, busy, releasing, onUnlock }: {
  lock: AccountLock;
  message: string | null;
  busy: boolean;
  releasing: boolean;
  onUnlock: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const waitMs = msUntilUnlockable(lock, now);
  const age = formatDuration(now - lock.lockedAt);
  const text = message ?? (waitMs > 0
    ? `Another execution of this account started ${age} ago and is still in progress, possibly from another signer. ` +
      `If it does not finish, you can unlock the account in ${formatDuration(waitMs)}.`
    : `An execution has held this account's lock for ${age} without reaching the chain, so it can no longer complete. ` +
      "Unlock the account to continue.");

  return (
    <div role="status" className="w-full rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-row items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[12px] font-[600] text-amber-800">Account locked</span>
        <span className="text-[12px] font-[400] text-amber-700">{text}</span>
      </div>
      <button
        type="button"
        onClick={onUnlock}
        disabled={busy || waitMs > 0}
        aria-busy={releasing}
        className="min-h-8 shrink-0 inline-flex items-center gap-2 rounded-[6px] bg-amber-600 px-3 text-[12px] font-[500] text-white hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {releasing && (
          <span aria-hidden className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
        )}
        {releasing ? "Unlocking…" : waitMs > 0 ? `Unlock in ${formatDuration(waitMs)}` : "Unlock account"}
      </button>
    </div>
  );
}

export default AccountStatusBanner;

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}
