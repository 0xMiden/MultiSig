"use client";
import { ProposalDetails } from "@/components/ProposalDetails";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMultisig } from "@/contexts/MultisigContext";
import { toast } from "sonner";
import { getProposalActionState } from "@/lib/proposalActions";
import { ProposalActionButton } from "@/components/ProposalActionButton";
import { signEach } from "@/lib/batchSign";

interface ApproveModalProps {
  open: boolean;
  onClose: () => void;
}

const LABEL: Record<string, string> = {
  p2id: "Send",
  consume_notes: "Receive",
};

const ApproveModal = ({ open, onClose }: ApproveModalProps) => {
  const {
    proposals,
    detectedConfig,
    activeCommitment,
    handleSignProposal,
    syncingState,
  } = useMultisig();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Why each proposal of the last batch failed, shown on its row.
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [batchSigning, setBatchSigning] = useState(false);

  const pendingProposals = useMemo(
    () => proposals.filter(p => p.status === "pending" || p.status === "ready"),
    [proposals]
  );

  const signableProposals = useMemo(
    () => pendingProposals.filter(
      (proposal) => getProposalActionState(proposal, detectedConfig, activeCommitment).action === "sign",
    ),
    [activeCommitment, detectedConfig, pendingProposals],
  );

  const handleSelectAll = () => {
    setSelectedIds(
      selectedIds.length === signableProposals.length
        ? []
        : signableProposals.map((proposal) => proposal.id),
    );
  };

  const handleToggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSignSelected = async () => {
    setBatchSigning(true);
    setFailures({});
    const { signed, failed } = await signEach(selectedIds, handleSignProposal);
    setBatchSigning(false);
    // Failed proposals stay selected, with their reasons, so they can be retried.
    setSelectedIds(failed.map((failure) => failure.id));
    setFailures(Object.fromEntries(failed.map((failure) => [failure.id, failure.message])));
    if (failed.length === 0) toast.success(`Signed ${signed.length} proposal${signed.length === 1 ? "" : "s"}`);
    else if (signed.length > 0) toast.warning(`Signed ${signed.length}; ${failed.length} failed. See the reasons below.`);
    else toast.error(`Could not sign ${failed.length} selected proposal${failed.length === 1 ? "" : "s"}. See the reasons below.`);
  };

  const proposalLabel = (type?: string) => {
    if (!type) return "Unknown";
    return LABEL[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="approve-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key="approve-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-transfers-title"
            onClick={e => e.stopPropagation()}
            initial={{ y: 8, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-[560px] max-w-[90vw] max-h-[85vh] bg-white rounded-[12px] border border-[rgba(0,0,0,0.08)] shadow-xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.06)] shrink-0">
              <div>
                <div id="approve-transfers-title" className="text-[16px] font-[600] text-[#111]">Approve Transfers</div>
                <div className="text-[11px] text-[rgba(0,0,0,0.4)] mt-0.5">
                  {pendingProposals.length} pending proposal{pendingProposals.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close approvals"
                className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-gray-100 text-[rgba(0,0,0,0.4)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Proposals list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
              {syncingState ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-[3px] border-[rgba(0,0,0,0.08)] border-t-[#FF5500] rounded-full animate-spin" />
                  <div className="text-[13px] text-[rgba(0,0,0,0.4)]">Loading proposals…</div>
                </div>
              ) : pendingProposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="text-[13px] text-[rgba(0,0,0,0.4)]">No pending proposals to approve</div>
                </div>
              ) : (
                pendingProposals.map(proposal => {
                  const action = getProposalActionState(proposal, detectedConfig, activeCommitment);
                  const isSelected = selectedIds.includes(proposal.id);
                  const selectable = action.action === "sign";

                  return (
                    <div
                      key={proposal.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-[8px] border transition-colors ${
                        isSelected ? "border-[#FF5500]/30 bg-[#FF5500]/5" : "border-[rgba(0,0,0,0.08)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggle(proposal.id)}
                        disabled={!selectable}
                        aria-label={`${isSelected ? "Deselect" : "Select"} ${proposalLabel(proposal.metadata?.proposalType)} proposal`}
                        className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? "border-[#FF5500] bg-[#FF5500]" : "border-[rgba(0,0,0,0.2)]"
                        } ${!selectable ? "opacity-30 cursor-not-allowed" : ""
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-[500] text-[#111]">
                          {proposalLabel(proposal.metadata?.proposalType)}
                        </div>
                        <ProposalDetails proposal={proposal} />
                        {failures[proposal.id] && (
                          <div role="alert" className="text-[11px] text-red-600 mt-0.5 wrap-break-word">
                            Not signed: {failures[proposal.id]}
                          </div>
                        )}
                        <div className="text-[11px] font-mono text-[rgba(0,0,0,0.35)] mt-0.5 truncate">
                          {proposal.id.slice(0, 20)}…
                        </div>
                      </div>

                      {/* Signature progress */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="text-[11px] tabular-nums text-[rgba(0,0,0,0.4)]">
                          {action.signatureCount}/{action.requiredSignatures || "—"} signed
                        </div>
                        <div className="flex gap-1">
                          {Array.from({ length: action.requiredSignatures }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${i < action.signatureCount ? "bg-[#28A857]" : "bg-[rgba(0,0,0,0.1)]"}`}
                            />
                          ))}
                        </div>
                      </div>

                      <ProposalActionButton proposal={proposal} className="shrink-0" />
                    </div>
                  );
                })
              )}
            </div>

            {/* Security notice */}
            <div className="mx-5 mb-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5 shrink-0">
              <div className="text-[12px] font-[600] text-red-600 mb-0.5">Security notice</div>
              <div className="text-[11px] text-[rgba(0,0,0,0.55)]">
                Verify all transfer details before approving. Once executed, transfers cannot be reversed.
              </div>
            </div>

            {/* Footer */}
            {pendingProposals.length > 0 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-[rgba(0,0,0,0.06)] shrink-0">
                <button
                  onClick={handleSelectAll}
                  disabled={signableProposals.length === 0}
                  className="h-9 px-4 rounded-[8px] border border-[rgba(0,0,0,0.08)] text-[12px] font-[500] text-[rgba(0,0,0,0.6)] hover:bg-gray-50 transition-colors"
                >
                  {selectedIds.length === signableProposals.length && signableProposals.length > 0
                    ? "Deselect all"
                    : `Select signable (${signableProposals.length})`}
                </button>

                {selectedIds.length > 0 && (
                  <button
                    onClick={handleSignSelected}
                    disabled={batchSigning}
                    className="h-9 px-4 rounded-[8px] bg-[#FF5500] hover:bg-[#E64A00] text-white text-[12px] font-[500] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {batchSigning ? "Signing…" : `Sign selected (${selectedIds.length})`}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ApproveModal;
