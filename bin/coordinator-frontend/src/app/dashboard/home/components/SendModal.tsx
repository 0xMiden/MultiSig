"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMultisig } from "@/contexts/MultisigContext";
import { toHexAccountId } from "@/lib/helpers";
import { toast } from "sonner";
import { useDashboardUI } from "@/contexts/DashboardUIContext";
import { useFaucetDecimals } from "@/hooks/useFaucetDecimals";
import { formatTokenAmount, parseTokenAmount } from "@/lib/tokenAmounts";

interface SendModalProps {
  open: boolean;
  onClose: () => void;
}

const SendModal = ({ open, onClose }: SendModalProps) => {
  const { sendProposalDraft, clearSendProposalDraft } = useDashboardUI();
  const {
    handleCreateP2idProposal,
    handleSendPrivateNote,
    privateSendProgress,
    resetPrivateSendProgress,
    creatingProposal,
    detectedConfig,
  } = useMultisig();

  const [formData, setFormData] = useState({ recipientId: "", amount: "", faucetId: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (!open || !sendProposalDraft) return;
    setFormData({
      recipientId: sendProposalDraft.recipientId,
      amount: sendProposalDraft.amount,
      faucetId: sendProposalDraft.faucetId,
    });
    setIsPrivate(sendProposalDraft.isPrivate);
    clearSendProposalDraft();
  }, [clearSendProposalDraft, open, sendProposalDraft]);

  const isSendingPrivately =
    isPrivate && privateSendProgress.step !== "idle" && privateSendProgress.step !== "error";

  const closeAndReset = useCallback(() => {
    resetPrivateSendProgress();
    onClose();
  }, [onClose, resetPrivateSendProgress]);

  useEffect(() => {
    if (privateSendProgress.step === "done") {
      const timer = setTimeout(() => {
        setFormData({ recipientId: "", amount: "", faucetId: "" });
        closeAndReset();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [closeAndReset, privateSendProgress.step]);

  const vaultBalances = useMemo(
    () => detectedConfig?.vaultBalances ?? [],
    [detectedConfig?.vaultBalances],
  );
  const threshold = detectedConfig?.threshold ?? 0;
  const signerCount = detectedConfig?.signerCommitments?.length ?? 0;

  const token = useFaucetDecimals(formData.faucetId);
  const selectedBalance = useMemo(
    () => vaultBalances.find(v => v.faucetId === formData.faucetId)?.amount ?? 0n,
    [formData.faucetId, vaultBalances],
  );

  const handleSubmit = async () => {
    setError(null);
    if (!formData.recipientId.trim()) { setError("Recipient account ID is required"); return; }
    if (!formData.faucetId.trim()) { setError("Please select a token"); return; }
    if (token.status !== "ready") {
      setError(token.error ?? "Loading token details, try again in a moment");
      return;
    }
    let amount: bigint;
    try {
      amount = parseTokenAmount(formData.amount, token.decimals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please enter a valid amount");
      return;
    }
    if (amount > selectedBalance) { setError("Amount exceeds the available balance"); return; }
    try {
      const recipientHex = toHexAccountId(formData.recipientId.trim());
      if (isPrivate) {
        await handleSendPrivateNote(recipientHex, formData.faucetId.trim(), amount);
        return;
      }
      await handleCreateP2idProposal(recipientHex, formData.faucetId.trim(), amount);
      setSuccess(true);
      toast.success("Send proposal created!");
      setTimeout(() => { setSuccess(false); setFormData({ recipientId: "", amount: "", faucetId: "" }); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create send proposal");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="send-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAndReset}
        >
          <motion.div
            key="send-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-funds-title"
            onClick={e => e.stopPropagation()}
            initial={{ y: 8, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-[480px] max-w-[90vw] bg-white rounded-[12px] border border-[rgba(0,0,0,0.08)] shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.06)]">
              <div id="send-funds-title" className="text-[16px] font-[600] text-[#111]">
                Send Funds
              </div>
              <button
                type="button"
                onClick={closeAndReset}
                aria-label="Close send funds"
                className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-gray-100 text-[rgba(0,0,0,0.4)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-4">
              {(error || privateSendProgress.error) && (
                <div role="alert" className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
                  {error || privateSendProgress.error}
                </div>
              )}

              {isSendingPrivately ? (
                <div className="flex flex-col gap-4 py-3">
                  <div className="flex items-center gap-3">
                    {privateSendProgress.step === "creating-proposal" ? (
                      <div className="w-5 h-5 shrink-0 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="w-5 h-5 shrink-0 rounded-full bg-[#28A857] flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <span className="text-[13px] font-[500] text-[#111]">Proposal created</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {privateSendProgress.step === "relaying-notes" ? (
                      <div className="w-5 h-5 shrink-0 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin" />
                    ) : privateSendProgress.step === "done" ? (
                      <div className="w-5 h-5 shrink-0 rounded-full bg-[#28A857] flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 shrink-0 rounded-full border-2 border-[rgba(0,0,0,0.15)]" />
                    )}
                    <span className="text-[13px] font-[500] text-[#111]">
                      Notes relayed
                      {privateSendProgress.totalNotes > 0
                        ? ` (${privateSendProgress.relayedNotes}/${privateSendProgress.totalNotes})`
                        : ""}
                    </span>
                  </div>
                </div>
              ) : (
                <>
              {/* Recipient */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-[500] text-[rgba(0,0,0,0.5)]">
                  Recipient Account ID
                </label>
                <input
                  type="text"
                  value={formData.recipientId}
                  onChange={e => setFormData(p => ({ ...p, recipientId: e.target.value }))}
                  placeholder="0x..."
                  className="w-full h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] px-3 font-mono text-[12px] text-[#111] placeholder:text-[rgba(0,0,0,0.3)] focus:outline-hidden focus:ring-1 focus:ring-[#FF5500] bg-white"
                />
              </div>

              {/* Token */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-[500] text-[rgba(0,0,0,0.5)]">
                  Token
                </label>
                <select
                  value={formData.faucetId}
                  onChange={e => setFormData(p => ({ ...p, faucetId: e.target.value }))}
                  className="w-full h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] px-3 text-[12px] text-[#111] focus:outline-hidden focus:ring-1 focus:ring-[#FF5500] bg-white"
                >
                  <option value="">Select token…</option>
                  {vaultBalances.map((b, i) => (
                    <option key={i} value={b.faucetId}>
                      {b.faucetId.slice(0, 16)}…
                    </option>
                  ))}
                </select>
                {formData.faucetId && (
                  <div className={`text-[11px] ${token.status === "error" ? "text-red-600" : "text-[rgba(0,0,0,0.4)]"}`}>
                    {token.status === "ready"
                      ? `Available: ${formatTokenAmount(selectedBalance, token.decimals)}`
                      : token.status === "error"
                        ? token.error
                        : "Loading token details…"}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-[500] text-[rgba(0,0,0,0.5)]">
                  Amount
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] px-3 text-[12px] text-[#111] placeholder:text-[rgba(0,0,0,0.3)] focus:outline-hidden focus:ring-1 focus:ring-[#FF5500] bg-white"
                />
              </div>

              {/* Send privately toggle */}
              <button
                type="button"
                onClick={() => setIsPrivate(p => !p)}
                className="flex items-center justify-between rounded-[8px] border border-[rgba(0,0,0,0.08)] px-3 h-10 text-left"
              >
                <span className="text-[12px] font-[500] text-[#111]">Send Privately</span>
                <span
                  className={`relative w-9 h-5 rounded-full transition-colors ${isPrivate ? "bg-[#FF5500]" : "bg-[rgba(0,0,0,0.15)]"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isPrivate ? "translate-x-4" : ""}`}
                  />
                </span>
              </button>
                </>
              )}

              {/* Actions */}
              {!isSendingPrivately && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={closeAndReset}
                    className="flex-1 h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] text-[13px] font-[500] text-[rgba(0,0,0,0.6)] hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={creatingProposal || !formData.recipientId || !formData.amount || !formData.faucetId || token.status !== "ready"}
                    className="flex-[2] h-10 rounded-[8px] bg-[#FF5500] hover:bg-[#E64A00] text-white text-[13px] font-[500] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingProposal
                      ? "Creating…"
                      : isPrivate
                        ? "Send Privately"
                        : "Create Transfer Request"}
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-5 py-3 border-t border-[rgba(0,0,0,0.06)] bg-[#f9f9f9] rounded-b-[12px] ${success || privateSendProgress.step === "done" ? "bg-green-50" : ""}`}>
              {success || privateSendProgress.step === "done" ? (
                <div className="text-[13px] font-[500] text-[#28A857]">
                  {privateSendProgress.step === "done"
                    ? "Private note relayed — queued for approval"
                    : "Transfer request initiated — queued for approval"}
                </div>
              ) : (
                <>
                  <div className="text-[12px] font-[500] text-[#111]">Multi-signature required</div>
                  <div className="text-[11px] text-[rgba(0,0,0,0.45)] mt-0.5">
                    Requires {threshold || "—"} of {signerCount || "—"} approvals before execution
                  </div>
                </>
              )}
            </div>

            {/* Loading overlay (public send only — private send shows its own step indicators) */}
            {creatingProposal && !isPrivate && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-[12px] z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-[3px] border-[#FF5500] border-t-transparent rounded-full animate-spin" />
                  <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">Creating proposal…</div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SendModal;
