"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import media from "../../../../public/media";
import { useAppSelector } from "@/store/hooks";
import { DecodedTransaction, RecentTransactionsProps } from "@/types";
import { TransactionRequest } from "@demox-labs/miden-sdk";
import { useMidenClient } from "../../../hooks/useMidenClient";

const getTransactionType = (
  txRequestBase64: string | undefined
): "sent" | "received" | null => {
  if (!txRequestBase64 || typeof txRequestBase64 !== "string" || txRequestBase64.trim() === "") {
    return null;
  }

  try {
    const serializedTxRequest = Uint8Array.fromBase64(txRequestBase64);
    const txRequest = TransactionRequest.deserialize(serializedTxRequest);
    return txRequest.expectedOutputOwnNotes().length === 0 ? "received" : "sent";
  } catch (error) {
    console.error("Error processing txRequest:", error);
    return null;
  }
};

const getSendTransactionAmount = (
  txbz: string | undefined,
  transactionType: "sent" | "received" | null
): number => {
  if (
    transactionType !== "sent" ||
    !txbz ||
    typeof txbz !== "string" ||
    txbz.trim() === ""
  ) {
    return 0;
  }

  try {

    const serializedTXBZ = (Uint8Array as any).fromBase64(txbz);
    const deserializedTXBZ = TransactionRequest.deserialize(serializedTXBZ);
    const expectedOutputOwnNotes = deserializedTXBZ.expectedOutputOwnNotes();

    if (expectedOutputOwnNotes.length > 0) {
      const firstNote = expectedOutputOwnNotes[0];
      const assets = firstNote.assets();
      const fungibleAssets = assets.fungibleAssets();

      if (fungibleAssets.length > 0) {
        const amount = fungibleAssets[0].amount();
        return Number(amount) / 1000000;
      }
    }

    return 0;
  } catch (error) {
    console.error("Error extracting transaction amount:", error);
    return 0;
  }
};

const getReceiveTransactionAmount = async (noteId: string, noteIdFileBytes: string, webClient: any): Promise<number> => {
  try {
    if (!noteId || typeof noteId !== "string" || noteId.trim() === "") {
      return 0;
    }

    if (!webClient) {
      console.error("WebClient not available");
      return 0;
    }

    let inputNoteRecord = await webClient.getInputNote(noteId);

    // If inputNoteRecord is undefined, import the note file
    if (!inputNoteRecord) {
      if (noteIdFileBytes) {
        const noteBytes = (Uint8Array as any).fromBase64(noteIdFileBytes);
        await webClient.importNoteFile(noteBytes);

        // Retry getting the note
        inputNoteRecord = await webClient.getInputNote(noteId);
      } else {
        console.error("No note file bytes to import");
        return 0;
      }
    }

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

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ threshold, fixedHeight = false }) => {
  const router = useRouter();
  const { allTransactions, loading: transactionsLoading } = useAppSelector(
    (state) => state.transaction
  );
  const { demo } = useMidenClient();
  const webClient = demo?.getWebClient();

  const [displayTransactions, setDisplayTransactions] = useState<DecodedTransaction[]>([]);
  const [amountsLoading, setAmountsLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const decodeAllTransactions = async () => {
      if (!allTransactions || allTransactions.length === 0) {
        if (isMounted) {
          setDisplayTransactions([]);
          setInitialLoad(false);
        }
        return;
      }

      setAmountsLoading(true);
      try {
        const decoded: DecodedTransaction[] = [];

        // Process transactions sequentially (one by one)
        for (let index = 0; index < allTransactions.length; index++) {
          if (!isMounted) break; // Stop if component unmounted

          const tx = allTransactions[index];
          const transactionType = getTransactionType(tx.tx_request);

          let amount = 0;
          if (transactionType === "sent") {
            amount = getSendTransactionAmount(tx.tx_request, transactionType);
          } else if (transactionType === "received" && tx.input_note_ids && tx.input_note_ids.length > 0 && webClient) {
            // Sum amounts from all input notes
            let totalAmount = 0;
            for (const inputNote of tx.input_note_ids) {
              if (!isMounted) break; // Stop if component unmounted

              const noteAmount = await getReceiveTransactionAmount(
                inputNote.note_id,
                inputNote.note_id_file_bytes,
                webClient
              );
              totalAmount += noteAmount;
            }
            amount = totalAmount;
          } else {
            amount = 0;
          }

          decoded.push({
            id: index,
            status: tx.status,
            signature_count: tx.signature_count,
            type:
              transactionType === "sent"
                ? "send"
                : transactionType === "received"
                  ? "receive"
                  : "transfer",
            transactionType: transactionType,
            recipient: "Unknown",
            amount: amount,
            currency: "USD",
            priority: "normal",
            memo: "",
            timestamp: null,
            created_at: tx.created_at,
          });
        }

        if (isMounted) {
          setDisplayTransactions(decoded);
          setInitialLoad(false);
        }
      } catch (error) {
        console.error("Error decoding transactions:", error);
        if (isMounted) {
          setDisplayTransactions([]);
          setInitialLoad(false);
        }
      } finally {
        if (isMounted) {
          setAmountsLoading(false);
        }
      }
    };

    decodeAllTransactions();

    return () => {
      isMounted = false;
    };
  }, [allTransactions, webClient]);

  const handleViewAll = () => {
    router.push('/dashboard/transactions');
  };

  return (
    <div className="flex flex-col gap-2 w-full border p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="text-[16px] font-dmmono font-[500] text-[#00000099]">
          RECENT TRANSACTIONS
        </div>
        {fixedHeight && (
          <button
            onClick={handleViewAll}
            className="text-[10px] font-dmmono font-[500] text-[#000000] italic hover:text-[#FF5500] transition-colors cursor-pointer"
          >
            VIEW ALL ▾
          </button>
        )}
      </div>

      {/* Transactions */}
      <div
        className={`flex flex-col gap-3 ${displayTransactions.length > 0
          ? fixedHeight
            ? displayTransactions.length >= 5
              ? "h-[400px] overflow-hidden" // Fixed height for 5+ items
              : "" // Dynamic height for less than 5 items
            : "max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" // Scrollable for 3 items (3 * 64px + 48px gap)
          : "h-[200px]" // Default height when no items
          }`}
      >
        {transactionsLoading || initialLoad ? (
          // Loading spinner
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00000033] border-t-[#FF5500]"></div>
              <p className="text-[#00000099] font-dmmono text-sm font-[400]">
                Loading transactions...
              </p>
            </div>
          </div>
        ) : displayTransactions.length > 0 ? (
          displayTransactions.map((tx: DecodedTransaction) => (
            <div
              key={tx.id}
              className="flex h-[64px] w-full flex-row items-center relative border-[0.5px] border-[#00000033] flex-shrink-0"
            >
              <div className="font-dmmono w-[10%] text-center text-[12px] font-[400]">
                {tx.created_at ? new Date(tx.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
              </div>
              <div className="h-full w-[0.5px] bg-[#00000033]"></div>
              <div className="font-dmmono w-[55%] pl-6 text-[12px] font-[400]">
                <span className="font-dmmono text-[12px] font-[500]">
                  {tx.transactionType === "sent"
                    ? `SEND Transaction - ${tx.amount.toFixed(2)} MIDEN`
                    : tx.transactionType === "received"
                      ? `RECEIVE Transaction - ${tx.amount.toFixed(2)} MIDEN`
                      : "Transaction"}
                </span>
              </div>
              <div className="h-full w-[0.5px] bg-[#00000033]"></div>
              <div className="justify-center items-center flex w-[10%] relative h-full">
                <Image
                  src={
                    tx.transactionType === "sent"
                      ? media.sendIcon
                      : media.receiveIcon
                  }
                  alt={tx.transactionType === "sent" ? "send" : "receive"}
                  quality={100}
                  className="w-[25%] h-[55%]"
                />
              </div>
              <div className="h-full w-[0.5px] bg-[#00000033]"></div>
              <div className="flex w-[15%] space-x-1 flex-row items-center justify-center">
                <span className="text-[12px] text-[#FF5500] font-dmmono font-[400]">
                  {tx.signature_count}/{threshold} signed
                </span>
              </div>
              <div className="h-full w-[0.5px] bg-[#00000033]"></div>

              <div className="w-[10%] text-center text-[12px] font-dmmono font-[400]">
                <span
                  className={`text-[10px] font-dmmono whitespace-nowrap ${tx.transactionType === "received"
                    ? "text-[#28A857]"
                    : "text-[#FF0000]"
                    }`}
                >
                  {tx.transactionType === "received" ? "+" : "-"}
                  {tx.amount.toFixed(2)} MIDEN
                </span>
              </div>
              <div className="h-full w-[0.5px] bg-[#00000033]"></div>
            </div>
          ))
        ) : (
          // Empty state when no recent transactions
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
            <p className="text-gray-500 font-dmmono text-sm font-[400]">
              No recent transactions
            </p>
            <p className="text-gray-400 font-dmmono text-xs font-[400] mt-1">
              Your transaction history will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentTransactions;
