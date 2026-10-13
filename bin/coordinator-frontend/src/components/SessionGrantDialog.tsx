"use client";

import React, { useEffect } from "react";
import { useMultisig } from "@/contexts/MultisigContext";

/**
 * Confirms a Guardian session grant for wallets that sign it as a hash (Para,
 * the Miden Wallet): they cannot show what they approve, so the app shows it
 * first. Ledger shows the grant's fields itself and never reaches this dialog.
 */
export function SessionGrantDialog() {
  const { sessionGrantPrompt, answerSessionGrant } = useMultisig();

  useEffect(() => {
    if (!sessionGrantPrompt) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") answerSessionGrant(false); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [sessionGrantPrompt, answerSessionGrant]);

  if (!sessionGrantPrompt) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-grant-title"
        className="w-full max-w-[480px] rounded-[12px] bg-white p-5 shadow-xl flex flex-col gap-3"
      >
        <h2 id="session-grant-title" className="text-[15px] font-[600] text-[#111]">
          Start a Guardian session
        </h2>
        <p className="text-[12px] leading-relaxed text-[#444]">
          Approve once in your wallet, and this site signs your Guardian requests (reading accounts,
          creating and signing proposals) without asking each time, until the session expires.
          Approving a transaction and executing it still ask your wallet.
        </p>
        <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-[11px]">
          {sessionGrantPrompt.rows.map(({ label, value }) => (
            <React.Fragment key={label}>
              <dt className="text-[rgba(0,0,0,0.55)]">{label}</dt>
              <dd className="break-all font-mono text-[#111]">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
        <p className="text-[11px] text-[rgba(0,0,0,0.55)]">
          Your wallet shows only a hash for this approval: these are the values it signs.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => answerSessionGrant(false)}
            className="min-h-9 rounded-[6px] border border-[rgba(0,0,0,0.15)] px-3 text-[12px] font-[500] text-[#111] hover:bg-[rgba(0,0,0,0.03)]"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => answerSessionGrant(true)}
            className="min-h-9 rounded-[6px] bg-[#FF5500] px-3 text-[12px] font-[500] text-white hover:bg-[#E64A00]"
          >
            Approve in wallet
          </button>
        </div>
      </div>
    </div>
  );
}
