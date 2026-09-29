"use client";

import React from "react";
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
    stuckCandidate,
    releasingCandidate,
    releaseStuckCandidateAndRetry,
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
  } = useMultisig();

  const fundingBusy = accountFunding.phase === "registering" || accountFunding.phase === "waiting-for-note";
  const busy = loadingAccount || registeringOnGuardian || syncingState || fundingBusy || releasingCandidate || Boolean(executingProposal);
  const configMissing = Boolean(multisig) && !detectedConfig && !busy;

  if (!error && !pendingCandidateWarning && !configMissing && accountFunding.phase === "idle") return null;

  const retry = () => {
    const operation = guardianRegistrationRequired ? retryGuardianRegistration : handleSync;
    operation().catch(() => {
      /* handleSync already reports failures through `error` */
    });
  };

  return (
    <div className="w-full flex flex-col gap-2 mb-4">
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
              could not be read. Check the console for{" "}
              <code className="font-mono">[DEBUG]</code> logs.
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

      {pendingCandidateWarning && (
        <div role="status" className="w-full rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-row items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            {stuckCandidate && (
              <span className="text-[12px] font-[600] text-amber-800">
                Account locked
              </span>
            )}
            <span className="text-[12px] font-[400] text-amber-700">
              {pendingCandidateWarning}
            </span>
          </div>
          {stuckCandidate && (
            <button
              type="button"
              onClick={() => void releaseStuckCandidateAndRetry()}
              disabled={busy}
              aria-busy={releasingCandidate}
              className="min-h-8 shrink-0 inline-flex items-center gap-2 rounded-[6px] bg-amber-600 px-3 text-[12px] font-[500] text-white hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {releasingCandidate && (
                <span aria-hidden className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {releasingCandidate ? "Unlocking…" : "Unlock account"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountStatusBanner;
