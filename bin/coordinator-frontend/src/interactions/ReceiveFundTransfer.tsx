"use client";
import { useState, useMemo } from "react";
import { useMultisig } from "@/contexts/MultisigContext";
import { toast } from "sonner";

const ReceiveFundTransfer = ({ onCancel }: { onCancel?: () => void }) => {
  const {
    consumableNotes,
    handleCreateConsumeNotesProposal,
    creatingProposal,
  } = useMultisig();

  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  const notes = useMemo(() => consumableNotes ?? [], [consumableNotes]);

  const handleSelectAll = () => {
    if (selectedNoteIds.length === notes.length) {
      setSelectedNoteIds([]);
    } else {
      setSelectedNoteIds(notes.map(n => n.id));
    }
  };

  const handleToggleNote = (noteId: string) => {
    setSelectedNoteIds(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  };

  const handleClaimSelected = async () => {
    if (selectedNoteIds.length === 0) {
      toast.error("Please select at least one note");
      return;
    }

    try {
      await handleCreateConsumeNotesProposal(selectedNoteIds);
      toast.success("Consume notes proposal created!");
      onCancel?.();
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="m-4 flex w-[639px] flex-col items-center rounded-[3px] border-[0.5px] border-[#00000033]">
      <div className="flex w-full items-center justify-center text-[40px] font-[500]">Receive Queued Notes</div>
      <div className="h-[0.5px] w-full bg-[#00000033]"></div>

      <div className="flex flex-col items-center space-y-[20px] w-full bg-[#FAFAFA] py-[20px]">
        {notes.length > 0 ? (
          notes.map((note, index) => {
            const isSelected = selectedNoteIds.includes(note.id);
            const totalAmount = note.assets.reduce((sum, a) => sum + Number(a.amount), 0) / 1000000;
            return (
              <div key={index} className="flex h-[72px] w-[90%] items-center rounded-[3px] border-[0.5px] border-[#00000033] bg-[#FFFFFF] px-[20px]">
                <div className="flex w-full flex-row items-center justify-between">
                  <div className="flex flex-row items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleNote(note.id)}
                      className="h-[12px] w-[12px] border-[0.5px]"
                    />
                    <div className="text-[16px] font-[510]">Receive {totalAmount.toFixed(2)} MIDEN</div>
                  </div>
                  <div className="flex flex-row items-center space-x-2">
                    <span className="font-dmmono text-[8px] text-gray-500">
                      {note.id.slice(0, 12)}...
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-gray-500 font-dmmono">No consumable notes available</div>
        )}

        <div className="flex w-[90%] flex-col rounded-[3px] border-[0.5px] border-[#00000033] bg-[#FCF0E9] p-2 px-3">
          <div className="text-[16px] font-[700] text-[#FF5500]">Security notice</div>
          <div className="text-[12px] font-[400]">Please verify the sender address and amount before claiming. Ensure this transfer is expected and legitimate. Once executed, transfers cannot be reversed.</div>
        </div>
      </div>

      <div className="h-[0.5px] w-full bg-[#00000033]"></div>

      <div className="flex flex-row items-center justify-between w-[90%] py-5">
        <button onClick={handleSelectAll} className="flex h-[36px] w-[128px] items-center justify-center rounded-[3px] border-[0.5px] border-[#00000033] bg-[#F8F9FC] text-[16px] uppercase">
          SELECT ALL
        </button>

        <div className="flex flex-row items-center space-x-4">
          <button onClick={onCancel} className="flex h-[36px] w-[90px] items-center justify-center rounded-[3px] border-[0.5px] border-[#00000033] bg-[#F8F9FC] text-[16px] font-[300] cursor-pointer">
            CANCEL
          </button>

          <button
            onClick={handleClaimSelected}
            disabled={selectedNoteIds.length === 0 || creatingProposal}
            className="font-dmmono flex h-[36px] w-[205px] items-center justify-center rounded-[3px] bg-[#70D494] text-[16px] font-[500] text-white uppercase disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {creatingProposal ? "PROCESSING..." : `CLAIM SELECTED (${selectedNoteIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiveFundTransfer;
