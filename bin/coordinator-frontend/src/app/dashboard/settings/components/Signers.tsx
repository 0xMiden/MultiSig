"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import media from "../../../../../public/media";
import { useMultisig } from "@/contexts/MultisigContext";
import { copyToClipboard, truncateHex } from "@/lib/helpers";
import { planRemoveSigner } from "@/lib/procedures";
import { toast } from "sonner";

const signerIcons = [media.signer1, media.signer2, media.signer3];

const Signers = () => {
  const {
    detectedConfig,
    multisig,
    syncingState,
    creatingProposal,
    handleCreateAddSignerProposal,
    handleCreateRemoveSignerProposal,
    handleCreateChangeThresholdProposal,
  } = useMultisig();

  const [newCommitment, setNewCommitment] = useState("");
  const [increaseThreshold, setIncreaseThreshold] = useState(false);
  const [newThreshold, setNewThreshold] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [commitmentToRemove, setCommitmentToRemove] = useState<string | null>(null);

  const signerCommitments = detectedConfig?.signerCommitments ?? [];
  const currentThreshold = detectedConfig?.threshold ?? 0;
  const numSigners = detectedConfig?.numSigners ?? signerCommitments.length;
  const removePlan = planRemoveSigner(currentThreshold, numSigners, detectedConfig?.procedureThresholds);
  const myCommitment = multisig?.signerCommitment;
  const displayThreshold = newThreshold ?? currentThreshold;
  const updateSignersThreshold = detectedConfig?.procedureThresholds?.get('update_signers') ?? null;

  useEffect(() => {
    setNewThreshold(null);
  }, [detectedConfig]);

  const handleCopy = (text: string) => {
    copyToClipboard(text, () => toast.success("Copied!"));
  };

  const handleAddSigner = async () => {
    setValidationError(null);
    if (!newCommitment.trim()) {
      setValidationError("Please enter a signer commitment");
      return;
    }
    try {
      await handleCreateAddSignerProposal(newCommitment.trim(), increaseThreshold);
    } catch {
      return; // reported by the context; keep the input so it can be retried
    }
    setNewCommitment("");
    setIncreaseThreshold(false);
  };

  const confirmRemoveSigner = async () => {
    if (!commitmentToRemove) return;
    setCommitmentToRemove(null);
    setValidationError(null);
    const plan = planRemoveSigner(currentThreshold, numSigners, detectedConfig?.procedureThresholds);
    await handleCreateRemoveSignerProposal(commitmentToRemove, plan.newThreshold).catch(() => {
      /* reported by the context */
    });
  };

  const handleChangeThreshold = async () => {
    setValidationError(null);
    if (newThreshold === null) return;
    if (newThreshold < 1 || newThreshold > numSigners) {
      setValidationError(`Threshold must be between 1 and ${numSigners}`);
      return;
    }
    try {
      await handleCreateChangeThresholdProposal(newThreshold);
    } catch {
      return; // reported by the context; keep the value so it can be retried
    }
    setNewThreshold(null);
  };

  if (!multisig) {
    return (
      <div className="w-full flex items-center justify-center py-16">
        <p className="text-[rgba(0,0,0,0.5)] text-sm">No account loaded</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4 relative">
      {/* Loading overlay */}
      {creatingProposal && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-[10px]">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#FF5500] border-t-transparent rounded-full animate-spin mb-3 mx-auto" />
            <div className="text-[14px] font-[500] text-[rgba(0,0,0,0.5)]">
              Creating proposal
            </div>
            <div className="text-[12px] text-[rgba(0,0,0,0.4)] mt-1">
              This may take a few seconds.
            </div>
          </div>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="w-full rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {validationError}
        </div>
      )}

      {/* Proposal notice */}
      <div className="w-full rounded-[8px] border border-[#FF550033] bg-[#FF55000A] px-3 py-2.5">
        <span className="text-[12px] font-[400] text-[#FF5500]">
          All changes create proposals requiring{" "}
          <span className="font-[600]">{currentThreshold} of {numSigners}</span>{" "}
          signatures before taking effect.
        </span>
      </div>

      {/* Current signers */}
      <div className="w-full rounded-[10px] border border-[rgba(0,0,0,0.08)] flex flex-col gap-3 p-4">
        <div className="flex flex-row items-center justify-between">
          <div className="text-[15px] font-[600] text-[#111]">
            Account Signers
          </div>
          {!syncingState && signerCommitments.length > 0 && (
            <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.5)]">
              {currentThreshold > 0
                ? `${currentThreshold} of ${signerCommitments.length} required`
                : `${signerCommitments.length} signers`}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {syncingState ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-7 w-7 border-2 border-[rgba(0,0,0,0.08)] border-t-[#FF5500]" />
                <p className="text-[rgba(0,0,0,0.5)] text-sm font-[400]">
                  Loading signers...
                </p>
              </div>
            </div>
          ) : signerCommitments.length > 0 ? (
            signerCommitments.map((commitment, index) => {
              const isMe =
                myCommitment &&
                commitment.toLowerCase() === myCommitment.toLowerCase();
              const canRemove = numSigners > 1;
              return (
                <div
                  key={index}
                  className="flex flex-row items-center gap-3 rounded-[8px] border border-[rgba(0,0,0,0.08)] p-3 bg-white"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-[8px] bg-[rgba(0,0,0,0.04)] relative shrink-0 overflow-hidden flex items-center justify-center">
                    <Image
                      src={signerIcons[index % signerIcons.length]}
                      alt="signer"
                      fill
                      style={{ objectFit: "contain" }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[13px] font-[500] text-[#111]">
                      Signer {index + 1}
                      {isMe && (
                        <span className="text-[#FF5500] ml-1.5 text-[11px] font-[400]">(you)</span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-mono text-[rgba(0,0,0,0.4)] truncate">
                        {truncateHex(commitment, 20, 10)}
                      </span>
                      <button
                        onClick={() => handleCopy(commitment)}
                        className="p-1 hover:bg-gray-100 rounded-[4px] transition-colors shrink-0"
                        title="Copy commitment"
                      >
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => setCommitmentToRemove(commitment)}
                    disabled={!canRemove || creatingProposal}
                    title={canRemove ? "Propose removing this signer" : "Cannot remove the only signer"}
                    className="shrink-0 px-3 py-1.5 text-[11px] font-[500] rounded-[8px] border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Remove
                  </button>
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-[rgba(0,0,0,0.5)] text-sm font-[400]">
                No signers found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add signer */}
      {detectedConfig && <div className="w-full rounded-[10px] border border-[rgba(0,0,0,0.08)] flex flex-col gap-3 p-4">
        <div className="text-[15px] font-[600] text-[#111]">
          Add Signer
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-[12px] font-[500] text-[rgba(0,0,0,0.5)]">
            New signer commitment
          </div>
          <input
            type="text"
            value={newCommitment}
            onChange={(e) => setNewCommitment(e.target.value)}
            placeholder="0x..."
            className="w-full h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] px-3 font-mono text-[12px] text-[#111] focus:outline-hidden focus:ring-1 focus:ring-[#FF5500] bg-white placeholder:text-[rgba(0,0,0,0.3)]"
          />
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={increaseThreshold}
              onChange={(e) => setIncreaseThreshold(e.target.checked)}
              className="accent-[#FF5500] w-4 h-4 rounded-sm"
            />
            <span className="text-[12px] font-[400] text-[rgba(0,0,0,0.6)]">
              Also increase threshold ({currentThreshold} → {currentThreshold + 1})
            </span>
          </label>
        </div>

        <button
          onClick={handleAddSigner}
          disabled={creatingProposal || !newCommitment.trim()}
          className="w-full h-10 bg-[#FF5500] text-white font-[500] text-[13px] rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#E64A00] transition-colors"
        >
          Create Add Signer Proposal
        </button>
      </div>}

      {/* Remove signer confirmation dialog */}
      <AnimatePresence>
        {commitmentToRemove && (
          <motion.div
            key="remove-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCommitmentToRemove(null)}
          >
            <motion.div
              key="remove-dialog"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 8, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 8, scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="w-[420px] max-w-[90vw] bg-white rounded-[12px] border border-[rgba(0,0,0,0.08)] shadow-xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-[8px] bg-[#FF55000A] border border-[#FF550033] flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-[#FF5500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-[15px] font-[600] text-[#FF5500]">Remove Signer</span>
                </div>
                <button
                  onClick={() => setCommitmentToRemove(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-gray-100 text-[rgba(0,0,0,0.4)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 flex flex-col gap-3">
                <p className="text-[13px] text-[rgba(0,0,0,0.6)] leading-relaxed">
                  This will create a proposal to permanently remove the following signer from the multisig.
                  The removal takes effect only after{" "}
                  <span className="font-[600] text-[#111]">{removePlan.approvalsRequired} of {numSigners}</span> signers approve it.
                  Afterwards the account needs{" "}
                  <span className="font-[600] text-[#111]">{removePlan.newThreshold} of {removePlan.remainingSigners}</span> signatures
                  {removePlan.thresholdChanges
                    ? ` (lowered from ${currentThreshold}, since only ${removePlan.remainingSigners} signers remain).`
                    : " (unchanged)."}
                </p>

                {/* Commitment display */}
                <div className="rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] px-3 py-2.5">
                  <div className="text-[10px] font-[500] text-[rgba(0,0,0,0.4)] uppercase tracking-wide mb-1">
                    Signer commitment
                    {myCommitment && commitmentToRemove.toLowerCase() === myCommitment.toLowerCase() && (
                      <span className="ml-1.5 text-red-500 normal-case tracking-normal">(you)</span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-[#111] break-all">{commitmentToRemove}</span>
                </div>

                {/* Self-removal warning */}
                {myCommitment && commitmentToRemove.toLowerCase() === myCommitment.toLowerCase() && (
                  <div className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5">
                    <div className="text-[12px] font-[600] text-red-600 mb-0.5">You are removing yourself</div>
                    <div className="text-[11px] text-[rgba(0,0,0,0.55)]">
                      Once this proposal is approved and executed, you will lose access to this multisig permanently.
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[rgba(0,0,0,0.06)]">
                <button
                  onClick={() => setCommitmentToRemove(null)}
                  className="h-9 px-4 rounded-[8px] border border-[rgba(0,0,0,0.08)] text-[12px] font-[500] text-[rgba(0,0,0,0.6)] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveSigner}
                  disabled={creatingProposal}
                  className="h-9 px-4 rounded-[8px] bg-[#FF5500] hover:bg-[#E64A00] text-white text-[12px] font-[500] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Create Remove Proposal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change threshold */}
      {detectedConfig && <div className="w-full rounded-[10px] border border-[rgba(0,0,0,0.08)] flex flex-col gap-3 p-4">
        <div className="text-[15px] font-[600] text-[#111]">
          Change Threshold
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.5)]">
            Default: {currentThreshold} of {numSigners} signers required
          </div>
          <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.5)]">
            Update signers override:{" "}
            {updateSignersThreshold !== null
              ? `${updateSignersThreshold} of ${numSigners} required`
              : "none (uses default)"}
          </div>
        </div>

        <div className="flex flex-row items-center gap-4">
          <button
            onClick={() => setNewThreshold(Math.max(1, displayThreshold - 1))}
            disabled={displayThreshold <= 1 || creatingProposal}
            className="w-10 h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] text-[20px] text-[#111] hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            −
          </button>

          <div className="flex flex-col items-center min-w-[48px]">
            <span className="text-[32px] font-[600] text-[#111] leading-none">
              {displayThreshold}
            </span>
            <span className="text-[11px] text-[rgba(0,0,0,0.4)] mt-0.5">
              of {numSigners}
            </span>
          </div>

          <button
            onClick={() => setNewThreshold(Math.min(numSigners, displayThreshold + 1))}
            disabled={displayThreshold >= numSigners || creatingProposal}
            className="w-10 h-10 rounded-[8px] border border-[rgba(0,0,0,0.08)] text-[20px] text-[#111] hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            +
          </button>
        </div>

        <button
          onClick={handleChangeThreshold}
          disabled={
            creatingProposal ||
            newThreshold === null ||
            newThreshold === currentThreshold
          }
          className="w-full h-10 bg-[#FF5500] text-white font-[500] text-[13px] rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#E64A00] transition-colors"
        >
          Create Change Threshold Proposal
        </button>
      </div>}
    </div>
  );
};

export default Signers;
