"use client";
import { useState, useEffect } from "react";
import { useMidenClient } from "@/contexts/MidenClientContext";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "@/store";
import { proposeTransactionWithTxBzThunk, fetchPendingTransactions, fetchConfirmedTransactions, getConsumableNotesThunk } from "../services/transactionApi";

// Helper function to get receive transaction amount
const getReceiveTransactionAmount = async (noteId: string, noteIdFileBytes: string, webClient: any): Promise<number> => {
  try {
    if (!noteId || typeof noteId !== "string" || noteId.trim() === "") {
      return 0;
    }

    if (!webClient) {
      console.error("WebClient not available");
      return 0;
    }

    // Step 2: Get input note using note_id
    let inputNoteRecord = await webClient.getInputNote(noteId);
    console.log("Retrieved note from database:", inputNoteRecord);

    // If inputNoteRecord is undefined, import the note file
    if (!inputNoteRecord) {
      console.log("inputNoteRecord is undefined, importing note file...");

      if (noteIdFileBytes) {
        const noteBytes = (Uint8Array as any).fromBase64(noteIdFileBytes);
        await webClient.importNoteFile(noteBytes);
        console.log("Note imported successfully");

        // Retry getting the note
        inputNoteRecord = await webClient.getInputNote(noteId);
        console.log("Retrieved note after import:", inputNoteRecord);
      } else {
        console.error("No note file bytes to import");
        return 0;
      }
    }

    // Step 3: Extract the amount using InputNoteRecord.details().assets().fungibleAssets()[0].amount()
    if (inputNoteRecord) {
      const details = inputNoteRecord.details();
      const assets = details.assets();
      const fungibleAssets = assets.fungibleAssets();

      if (fungibleAssets.length > 0) {
        const amount = fungibleAssets[0].amount();
        return Number(amount) / 1000000;
      }
    }

    return 0;
  } catch (error) {
    console.error("Error extracting amount from note:", error);
    return 0;
  }
};

const ReceiveFundTransfer = ({ onCancel, onAssetsUpdated }: { onCancel?: () => void; onAssetsUpdated?: () => Promise<void> }) => {
  const { handle, isInitialized } = useMidenClient();
  const dispatch = useDispatch<AppDispatch>();
  const { consumableNotes, loading } = useSelector((state: any) => state.transaction);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [isConsuming, setIsConsuming] = useState(false);
  const [noteAmounts, setNoteAmounts] = useState<{ [noteId: string]: number }>({});
  const [amountsLoading, setAmountsLoading] = useState(false);

  const webClient = handle.getWebClient();

  const noteIds = consumableNotes?.note_ids || [];

  useEffect(() => {
    dispatch(getConsumableNotesThunk());
  }, [dispatch]);

  useEffect(() => {
    const calculateAmounts = async () => {
      if (!webClient || noteIds.length === 0) {
        return;
      }

      setAmountsLoading(true);
      const amounts: { [noteId: string]: number } = {};

      for (const note of noteIds) {
        const noteId = note.note_id || '';
        const noteIdFileBytes = note.note_id_file_bytes || '';

        const amount = await getReceiveTransactionAmount(noteId, noteIdFileBytes, webClient);
        amounts[noteId] = amount;
      }

      setNoteAmounts(amounts);
      setAmountsLoading(false);
    };

    calculateAmounts();
  }, [noteIds, webClient]);

  const handleSelectAll = () => {
    if (selectedNoteIds.length === noteIds.length) {
      setSelectedNoteIds([]);
    } else {
      setSelectedNoteIds(noteIds.map((note: any) => note.note_id));
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
      alert("Please select at least one note");
      return;
    }

    if (!handle || !isInitialized) {
      alert("Miden client not initialized");
      return;
    }

    if (!webClient) {
      alert("WebClient not available");
      return;
    }

    setIsConsuming(true);
    try {
      // Create consume transaction request with selected noteIds
      const transactionRequest = webClient.newConsumeTransactionRequest(selectedNoteIds);
      console.log("TRANSACTION REQUEST - ", transactionRequest);
      const serializedRequest = transactionRequest.serialize();

      const tx_bz = (serializedRequest as any).toBase64();
      console.log("TX BZ (base64) - ", tx_bz);

      // Propose transaction
      const result = await dispatch(proposeTransactionWithTxBzThunk({
        accountId: localStorage.getItem("currentWalletId") || "",
        txBz: tx_bz
      })).unwrap();

      // Refresh transactions after successful consumption
      try {
        const currentWalletId = localStorage.getItem("currentWalletId");
        if (currentWalletId) {
          await Promise.all([
            dispatch(fetchPendingTransactions({ accountId: currentWalletId })),
            dispatch(fetchConfirmedTransactions({ accountId: currentWalletId }))
          ]);
        }
      } catch (refreshError) {
        console.warn("Failed to refresh transactions:", refreshError);
      }

      // Refresh fungible assets after successful consumption
      if (onAssetsUpdated) {
        try {
          await onAssetsUpdated();
        } catch (assetsError) {
          console.warn("Failed to refresh assets:", assetsError);
        }
      }

      // Close the modal after successful consumption
      onCancel?.();
    } catch (error) {
      console.error("Error consuming notes:", error);
      alert(`Error consuming notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConsuming(false);
    }
  };

  return (
    <div className="m-4 flex w-[639px] flex-col items-center rounded-[3px] border-[0.5px] border-[#00000033]">
      <div className="flex w-full items-center justify-center text-[40px] font-[500]">Receive Queued Notes</div>
      <div className="h-[0.5px] w-full bg-[#00000033]"></div>

      <div className="flex flex-col items-center space-y-[20px] w-full bg-[#FAFAFA] py-[20px]">
        {loading || amountsLoading ? (
          <div className="py-8">Loading notes...</div>
        ) : noteIds.length > 0 ? (
          noteIds.map((note: any, index: number) => {
            const noteId = note.note_id || '';
            const noteIdFileBytes = note.note_id_file_bytes || '';
            const isSelected = selectedNoteIds.includes(noteId);
            const amount = noteAmounts[noteId] || 0;
            return (
              <div key={index} className="flex h-[72px] w-[90%] items-center rounded-[3px] border-[0.5px] border-[#00000033] bg-[#FFFFFF] px-[20px]">
                <div className="flex w-full flex-row items-center justify-between">
                  <div className="flex flex-row items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleNote(noteId)}
                      className="h-[12px] w-[12px] border-[0.5px]"
                    />
                    <div className="text-[16px] font-[510]">Receive {amount.toFixed(2)} MIDEN</div>
                  </div>
                  <div className="flex flex-row items-center space-x-2">
                    <button className="font-dmmono h-[24px] w-[56px] bg-[#FF5500] text-center text-[8px] font-[500] text-white">STANDARD</button>
                    <button className="h-[24px] w-[56px] border-[0.37px] border-[#FF5500] text-center text-[8px] font-[500]">1 NEEDED</button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8">No consumable notes available</div>
        )}

        <div className="flex w-[90%] flex-col rounded-[3px] border-[0.5px] border-[#00000033] bg-[#FCF0E9] p-2 px-3">
          <div className="text-[16px] font-[700] text-[#FF5500]">Security notice</div>
          <div className="text-[12px] font-[400]">Please verify the sender address and amount before claiming. Ensure this transfer is expected and legitimate. once executed, transfers cannot be reversed.</div>
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
            disabled={selectedNoteIds.length === 0 || isConsuming}
            className="font-dmmono flex h-[36px] w-[205px] items-center justify-center rounded-[3px] bg-[#70D494] text-[16px] font-[500] text-white uppercase disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isConsuming ? "PROCESSING..." : `CLAIM SELECTED (${selectedNoteIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiveFundTransfer;
