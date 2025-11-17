"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import media from "../../../../public/media";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import PendingTransactionDetails from "@/interactions/PendingTransactionDetails";
import { AnimatePresence, motion } from "framer-motion";
import { TransactionRequest, TransactionSummary, SigningInputs } from "@demox-labs/miden-sdk";
import { useMidenClient } from "../../../contexts/MidenClientContext";
import { fetchPendingTransactions, fetchConfirmedTransactions} from "../../../services/transactionApi";
import { addSignatureThunk } from "../../../services/signatureApi";
import { useWallet } from "@demox-labs/miden-wallet-adapter";
import { PendingActionsProps, DecodedTransaction, WebClient } from "@/types";

const getSendTransactionAmount = (
  txRequestBase64: string | undefined,
  transactionType: "sent" | "received" | null
): number => {
  if (
    transactionType !== "sent" ||
    !txRequestBase64 ||
    typeof txRequestBase64 !== "string" ||
    txRequestBase64.trim() === ""
  ) {
    return 0;
  }

  try {
    const serializedTxRequest = Uint8Array.fromBase64(txRequestBase64);
    const txRequest = TransactionRequest.deserialize(serializedTxRequest);
    const expectedOutputOwnNotes = txRequest.expectedOutputOwnNotes();

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

const getReceiveTransactionAmount = async (noteId: string, noteIdFileBytes: string, webClient: WebClient | null): Promise<number> => {
  try {
    if (!noteId || typeof noteId !== "string" || noteId.trim() === "") {
      return 0;
    }

    if (!webClient) {
      console.error("WebClient not available");
      return 0;
    }

    let inputNoteRecord = await webClient.getInputNote(noteId);
    if (!inputNoteRecord) {
      if (noteIdFileBytes) {
        const noteBytes = Uint8Array.fromBase64(noteIdFileBytes);
        await webClient.importNoteFile(noteBytes);
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

const PendingActions: React.FC<PendingActionsProps> = ({ threshold, fixedHeight = false }) => {
  const router = useRouter();
  const { wallet, accountId, connected, signBytes } = useWallet();
  const { handle, isInitialized } = useMidenClient();
  const dispatch = useAppDispatch();
  const { pendingTransactions, loading: transactionsLoading } = useAppSelector(
    (state) => state.transaction
  );

  const webClient = handle?.getWebClient();
  const [decodedPendingTransactions, setDecodedPendingTransactions] = useState<DecodedTransaction[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (transactionsLoading) {
      setHasLoadedOnce(true);
    }
    if (!transactionsLoading && hasLoadedOnce) {
      setInitialLoad(false);
    }
  }, [transactionsLoading, hasLoadedOnce]);

  const handleSign = async (txReqFromApi: string, txId: string) => {
    if (!wallet || !accountId || !connected) {
      setShowWalletErrorModal(true);
      setTimeout(() => {
        setShowWalletErrorModal(false);
      }, 3000);
      return;
    }

    if (!signBytes) {
      showNotification("error", "Sign bytes functionality not available");
      return;
    }

    if (!txReqFromApi?.trim()) {
      showNotification("error", "Please provide a transaction request to sign");
      return;
    }

    setSigningTransactionId(txId);
    try {
      const txReqBytes = new Uint8Array(
        atob(txReqFromApi)
          .split('')
          .map(char => char.charCodeAt(0))
      );
      const transactionSummary = TransactionSummary.deserialize(txReqBytes);
      const signingInputs = SigningInputs.newTransactionSummary(transactionSummary);
      let signature: Uint8Array;
      try {
        signature = await signBytes(signingInputs.serialize(), "signingInputs");
      } catch (signError) {
        console.error("Signature creation failed:", signError);
        throw new Error(
          `Signature failed: ${signError instanceof Error ? signError.message : "Unknown error"
          }`
        );
      }

      const signatureBase64 = btoa(String.fromCharCode(...signature));

      try {
        const signatureData = {
          tx_id: txId,
          approver: accountId,
          signature: signatureBase64,
        };

        await dispatch(
          addSignatureThunk({
            txId: txId,
            signatureData,
          })
        ).unwrap();

        if (handle && isInitialized) {
          try {
            await handle.syncState();
          } catch (syncError) {
            console.error("Error syncing state after signature:", syncError);
          }
        }

        await refreshAllTransactions();

        showNotification("success", "Transaction Signed Successfully!");
      } catch (signatureError) {
        console.error("Error submitting signature:", signatureError);
        showNotification(
          "error",
          "Failed to submit signature. Please try again."
        );
      }
    } catch (error) {
      console.error("Signing failed:", error);
      showNotification("error", "Signing failed. Please try again.");
    } finally {
      setSigningTransactionId(null);
    }
  };

  const getTransactionType = (
    txbz: string | undefined
  ): "sent" | "received" | null => {
    if (!txbz || typeof txbz !== "string" || txbz.trim() === "") {
      return null;
    }

    try {
      // Decode base64 to get the transaction request
      const serializedTXBZ = Uint8Array.fromBase64(txbz);
      const deserializedTXBZ = TransactionRequest.deserialize(serializedTXBZ);
      const expectedOutputOwnNotes = deserializedTXBZ.expectedOutputOwnNotes();

      return expectedOutputOwnNotes.length === 0 ? "received" : "sent";
    } catch (error) {
      console.error("Error processing tx_bz:", error);
      return null;
    }
  };

  useEffect(() => {
    const decodePendingTransactions = async () => {
      if (!pendingTransactions || pendingTransactions.length === 0) {
        setDecodedPendingTransactions([]);
        return;
      }

      try {
        const decoded: DecodedTransaction[] = [];

        for (let index = 0; index < pendingTransactions.length; index++) {
          const tx = pendingTransactions[index];

          const transactionType = getTransactionType(tx.tx_request);
          const txId = tx.id;

          let amount = 0;

          if (transactionType === "sent") {
            amount = getSendTransactionAmount(tx.tx_request, transactionType);
          } else if (transactionType === "received" && tx.input_note_ids && tx.input_note_ids.length > 0 && webClient) {
            let totalAmount = 0;
            for (const inputNote of tx.input_note_ids) {
              const noteAmount = await getReceiveTransactionAmount(
                inputNote.note_id,
                inputNote.note_id_file_bytes,
                webClient
              );
              totalAmount += noteAmount;
            }
            amount = totalAmount;
          }

          if (amount === 0 && transactionType) {
            console.warn(`Transaction ${index} has 0 amount! Type: ${transactionType}`);
          }

          decoded.push({
            id: txId,
            status: tx.status,
            signature_count: tx.signature_count || 0,
            type: transactionType === "sent" ? "send" : transactionType === "received" ? "receive" : "transfer",
            transactionType: transactionType,
            recipient: "", // Not available for pending transactions
            amount: amount,
            currency: "MIDEN",
            priority: "normal",
            memo: "",
            timestamp: null,
            created_at: tx.created_at || "",
            tx_request: tx.tx_request,
            tx_summary: tx.tx_summary,
          } as any);
        }

        setDecodedPendingTransactions(decoded);
      } catch (error) {
        console.error("PendingActions: Error decoding transactions:", error);
        setDecodedPendingTransactions([]);
      }
    };

    decodePendingTransactions();
  }, [pendingTransactions, webClient]);

  const [isPendingTransactionDetailsOpen, setIsPendingTransactionDetailsOpen] =
    useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [signingTransactionId, setSigningTransactionId] = useState<string | null>(null);
  const [showWalletErrorModal, setShowWalletErrorModal] = useState(false);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const refreshAllTransactions = async () => {
    try {
      const currentWalletId = localStorage.getItem("currentWalletId");
      if (currentWalletId) {
        await dispatch(
          fetchPendingTransactions({ accountId: currentWalletId })
        );
        await dispatch(
          fetchConfirmedTransactions({ accountId: currentWalletId })
        );
      }
    } catch (error) {
      console.error("Error refreshing transactions:", error);
    }
  };

  const handleClosePendingTransactionDetails = () => {
    setIsPendingTransactionDetailsOpen(false);
  };

  const handleViewAll = () => {
    router.push('/dashboard/transactions');
  };



  return (
    <div className="flex flex-col gap-2 border-[0.5px] border-[#00000033] p-4 font-dmmono w-full">
      <div className="flex justify-between items-center">
        <div className="#00000099 font-[500] text-[#00000099] text-[16px]">
          PENDING ACTIONS
        </div>
        {fixedHeight && (
          <button
            onClick={handleViewAll}
            className="font-dmmono font-[500] text-[#000000] text-[10px] italic hover:text-[#FF5500] transition-colors cursor-pointer"
          >
            VIEW ALL
          </button>
        )}
      </div>

      <div
        className={`flex flex-col gap-2 ${decodedPendingTransactions.length > 0
          ? fixedHeight
            ? decodedPendingTransactions.length >= 5
              ? "h-[360px] overflow-hidden" // Fixed height for 5+ items
              : "" // Dynamic height for less than 5 items
            : "max-h-[210px] overflow-y-auto scrollbar-thin scrollbar-track-gray-200 scrollbar-thumb-[#CCCCCC] scrollbar-w-[20px]"
          : "h-[200px]" // Default height when no items
          }`}
      >
        {transactionsLoading || initialLoad ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00000033] border-t-[#FF5500]"></div>
              <p className="text-[#00000099] font-dmmono text-sm font-[400]">
                Loading transactions...
              </p>
            </div>
          </div>
        ) : decodedPendingTransactions.length > 0 ? (
          decodedPendingTransactions.map((tx, index) => {
            return (
              <div
                key={index}
                className="flex h-[64px] w-full flex-row items-center  border-[0.5px] border-[#00000033] flex-shrink-0"
              >
                <div className="font-dmmono w-[10%] text-center text-[12px] font-[400]">
                  {tx.created_at ? new Date(tx.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="font-dmmono w-[55%] pl-6 text-[12px] font-[400]">
                  <span className="font-dmmono text-[12px] font-[500]">
                    {tx.transactionType === "sent"
                      ? `SEND Transaction - ${tx.amount ? tx.amount.toFixed(2) : '0.00'} MIDEN`
                      : tx.transactionType === "received"
                        ? `RECEIVE Transaction - ${tx.amount ? tx.amount.toFixed(2) : '0.00'} MIDEN`
                        : "Transaction"}
                  </span>
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="justify-center items-center flex w-[10%] relative h-full  ">
                  <Image
                    src={
                      tx.transactionType === "sent"
                        ? media.sendIcon
                        : media.receiveIcon
                    }
                    alt={tx.transactionType === "sent" ? "send" : "receive"}
                    quality={100}
                    className="w-[25%] h-[55%] "
                  />
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="flex w-[15%] space-x-1 flex-row items-center justify-center">
                  <div className="relative w-[20px] h-[20px]">
                    <Image
                      src={media.userIcon}
                      alt="icon"
                      quality={100}
                      objectFit="contain"
                      fill
                    />
                  </div>
                  <span className="text-[12px] font-dmmono font-[400]">
                    {tx.signature_count}/{threshold} signed
                  </span>
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="flex items-center justify-center  w-[10%]">
                  <div className="bg-[#FF5500] text-white p-1.5  text-[8px] font-dmmono font-[400]">
                    {(threshold || 0) - tx.signature_count} NEEDED
                  </div>
                </div>

                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <button
                  onClick={() => {
                    handleSign(tx.tx_summary || "", tx.id);
                  }}
                  disabled={signingTransactionId === tx.id}
                  className={`w-[10%] text-center text-[12px] font-dmmono font-[400] ${signingTransactionId === tx.id
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-100"
                    }`}
                >
                  {signingTransactionId === tx.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></div>
                      <span>Signing...</span>
                    </div>
                  ) : (
                    "SIGN"
                  )}
                </button>
              </div>
            );
          })
        ) : (
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-gray-500 font-dmmono text-sm font-[400]">
              No pending transactions
            </p>
            <p className="text-gray-400 font-dmmono text-xs font-[400] mt-1">
              All transactions have been processed
            </p>
          </div>
        )}
      </div>
      <AnimatePresence>
        {isPendingTransactionDetailsOpen && (
          <motion.div
            key="pending-details-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#FBFCFD]/60 backdrop-blur-sm"
            onClick={handleClosePendingTransactionDetails}
          >
            <motion.div
              key="pending-details-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 8, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <PendingTransactionDetails
                onClose={handleClosePendingTransactionDetails}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg font-dmmono text-sm font-medium ${notification.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
              }`}
          >
            <div className="flex items-center gap-2">
              <span>{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWalletErrorModal && (
          <motion.div
            key="wallet-error-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWalletErrorModal(false)}
          >
            <motion.div
              key="wallet-error-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            >
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-dmmono font-semibold text-center mb-2">
                No Wallet Connected
              </h3>
              <p className="text-sm font-dmmono text-gray-600 text-center mb-6">
                Please connect your wallet to sign transactions.
              </p>
              <div className="flex justify-center">
                <button
                  onClick={() => setShowWalletErrorModal(false)}
                  className="bg-[rgba(255,85,0,1)] text-white px-6 py-2 rounded font-dmmono font-medium hover:bg-[rgba(255,85,0,0.9)] transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PendingActions;
