"use client";

import React, { useEffect, useRef } from "react";
import { useMultisig } from "@/contexts/MultisigContext";

const HEX = /^0x[\da-f]+$/i;

/**
 * Shows a Guardian session grant before the wallet signs it. Para and the
 * Miden Wallet sign it as a hash, and so does a Ledger with blind signing, so
 * this is the one place the user sees what they approve. A native modal
 * dialog: top layer (above the Ledger panel), inert background, Escape cancels.
 */
export function SessionGrantDialog() {
  const { sessionGrantPrompt, answerSessionGrant } = useMultisig();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (sessionGrantPrompt && !dialog.current?.open) dialog.current?.showModal();
    else if (!sessionGrantPrompt) dialog.current?.close();
  }, [sessionGrantPrompt]);

  const answer = (approved: boolean) => {
    if (sessionGrantPrompt) answerSessionGrant(sessionGrantPrompt.id, approved);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="session-grant-title"
      onCancel={(event) => {
        event.preventDefault();
        answer(false);
      }}
      className="w-[min(480px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[12px] bg-white p-5 shadow-xl backdrop:bg-black/40"
    >
      {sessionGrantPrompt && (
        <div className="flex flex-col gap-3">
          <h2 id="session-grant-title" className="text-[15px] font-[600] text-[#111]">
            Start a Guardian session
          </h2>
          <p className="text-[12px] leading-relaxed text-[#444]">
            Approve once in your wallet, and this site signs your Guardian requests without asking
            each time until the session expires: reading accounts, and creating proposals and sending
            their signatures. Your wallet still approves every transaction you sign and every execute,
            unlock and registration. The session covers every account this wallet cosigns on this
            Guardian, now or later.
          </p>
          <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-[11px]">
            {sessionGrantPrompt.rows.map(({ label, value }) => (
              <React.Fragment key={label}>
                <dt className="text-[rgba(0,0,0,0.55)]">{label}</dt>
                <dd className={HEX.test(value) ? "break-all font-mono text-[#111]" : "text-[#111]"}>{value}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p className="text-[11px] text-[rgba(0,0,0,0.55)]">
            Your wallet may show only a hash of these values. The session starts when you approve.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => answer(false)}
              className="min-h-9 rounded-[6px] border border-[rgba(0,0,0,0.15)] px-3 text-[12px] font-[500] text-[#111] hover:bg-[rgba(0,0,0,0.03)]"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => answer(true)}
              className="min-h-9 rounded-[6px] bg-[#FF5500] px-3 text-[12px] font-[500] text-white hover:bg-[#E64A00]"
            >
              Approve in wallet
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
