"use client";
import { TokenAmount } from "@/components/TokenAmount";
import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMultisig } from "@/contexts/MultisigContext";
import { toast } from "sonner";
import { useDashboardUI } from "@/contexts/DashboardUIContext";

interface ReceiveModalProps {
  open: boolean;
  onClose: () => void;
}

const ReceiveModal = ({ open, onClose }: ReceiveModalProps) => {
  const { receiveProposalDraft, clearReceiveProposalDraft } = useDashboardUI();
  const { consumableNotes, proposals, handleCreateConsumeNotesProposal, creatingProposal } = useMultisig();
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  const proposedNoteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of proposals ?? []) {
      // Include finalized proposals too: a note can only be consumed once, and
      // the local note store can lag behind on-chain state right after execute
      // (especially under the para/delegated-signing flow), so an already-
      // executed note can briefly still show up from getConsumableNotes().
      if (
        p.metadata.proposalType === "consume_notes"
        && !(p.verification.status === "failed" && !p.verification.retryable)
      ) {
        for (const id of p.metadata.noteIds) ids.add(id);
      }
    }
    return ids;
  }, [proposals]);

  const notes = useMemo(
    () => (consumableNotes ?? []).filter(n => !proposedNoteIds.has(n.id)),
    [consumableNotes, proposedNoteIds]
  );

  useEffect(() => {
    if (!open || receiveProposalDraft.length === 0) return;
    const available = new Set(notes.map((note) => note.id));
    setSelectedNoteIds(receiveProposalDraft.filter((noteId) => available.has(noteId)));
    clearReceiveProposalDraft();
  }, [clearReceiveProposalDraft, notes, open, receiveProposalDraft]);

  const handleSelectAll = () => {
    setSelectedNoteIds(selectedNoteIds.length === notes.length ? [] : notes.map(n => n.id));
  };

  const handleToggleNote = (noteId: string) => {
    setSelectedNoteIds(prev =>
      prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
    );
  };

  const handleClaimSelected = async () => {
    if (selectedNoteIds.length === 0) { toast.error("Select at least one note"); return; }
    try {
      await handleCreateConsumeNotesProposal(selectedNoteIds);
      setSelectedNoteIds([]);
      onClose();
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="receive-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key="receive-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receive-notes-title"
            onClick={e => e.stopPropagation()}
            initial={{ y: 8, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-[500px] max-w-[90vw] max-h-[85vh] bg-white rounded-[12px] border border-[rgba(0,0,0,0.08)] shadow-xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.06)] shrink-0">
              <div id="receive-notes-title" className="text-[16px] font-[600] text-[#111]">Receive Notes</div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close receive notes"
                className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-gray-100 text-[rgba(0,0,0,0.4)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
              {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="text-[13px] text-[rgba(0,0,0,0.4)]">No consumable notes available</div>
                </div>
              ) : (
                notes.map((note, index) => {
                  const isSelected = selectedNoteIds.includes(note.id);
                  return (
                    <button
                      key={index}
                      onClick={() => handleToggleNote(note.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-[8px] border text-left transition-colors ${
                        isSelected
                          ? "border-[#FF5500]/30 bg-[#FF5500]/5"
                          : "border-[rgba(0,0,0,0.08)] hover:bg-gray-50"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? "border-[#FF5500] bg-[#FF5500]" : "border-[rgba(0,0,0,0.2)]"
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        {/* One line per asset, each in its own token's units and symbol: never
                            summed, never labelled with a name the token did not give itself. */}
                        <div className="text-[13px] font-[500] text-[#111] flex flex-col">
                          {note.assets.length === 0 ? "Note with no assets" : note.assets.map((asset) => (
                            <span key={asset.faucetId}>
                              Receive <TokenAmount faucetId={asset.faucetId} amount={asset.amount} />
                            </span>
                          ))}
                        </div>
                        <div className="text-[11px] font-mono text-[rgba(0,0,0,0.35)] mt-0.5">
                          {note.id.slice(0, 12)}…
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Security notice */}
            <div className="mx-5 mb-4 rounded-[8px] border border-[#FF550033] bg-[#FF55000A] px-3 py-2.5 shrink-0">
              <div className="text-[12px] font-[600] text-[#FF5500] mb-0.5">Security notice</div>
              <div className="text-[11px] text-[rgba(0,0,0,0.55)]">
                Verify sender and amount before claiming. Once executed, transfers cannot be reversed.
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-[rgba(0,0,0,0.06)] shrink-0">
              <button
                onClick={handleSelectAll}
                className="h-9 px-4 rounded-[8px] border border-[rgba(0,0,0,0.08)] text-[12px] font-[500] text-[rgba(0,0,0,0.6)] hover:bg-gray-50 transition-colors"
              >
                {selectedNoteIds.length === notes.length && notes.length > 0 ? "Deselect all" : "Select all"}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="h-9 px-4 rounded-[8px] border border-[rgba(0,0,0,0.08)] text-[12px] font-[500] text-[rgba(0,0,0,0.6)] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClaimSelected}
                  disabled={selectedNoteIds.length === 0 || creatingProposal}
                  className="h-9 px-4 rounded-[8px] bg-[#FF5500] hover:bg-[#E64A00] text-white text-[12px] font-[500] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {creatingProposal ? "Processing…" : `Claim selected (${selectedNoteIds.length})`}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReceiveModal;
