"use client";
import React, { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import media from "../../../../public/media";
import { useMultisig } from "@/contexts/MultisigContext";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { PendingActionsProps } from "@/types";
import { getEffectiveThreshold } from "@/lib/procedures";

const PendingActions: React.FC<PendingActionsProps> = ({ threshold, fixedHeight = false }) => {
  const router = useRouter();
  const {
    proposals,
    detectedConfig,
    handleSignProposal,
    handleExecuteProposal,
    signingProposal,
    executingProposal,
    syncingState,
    error: contextError,
  } = useMultisig();

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  // Filter to only show pending (not yet executed) proposals
  const pendingProposals = useMemo(() => {
    return proposals.filter(p => p.status.type === 'pending' || p.status.type === 'ready');
  }, [proposals]);

  const effectiveThreshold = threshold ?? detectedConfig?.threshold ?? 0;

  const handleSign = async (proposalId: string) => {
    try {
      await handleSignProposal(proposalId);
      toast.success("Proposal signed successfully!");
    } catch (err) {
      showNotification("error", "Signing failed. Please try again.");
    }
  };

  const handleExecute = async (proposalId: string) => {
    try {
      await handleExecuteProposal(proposalId);
    } catch (err) {
      showNotification("error", "Execution failed. Please try again.");
    }
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
        className={`flex flex-col gap-2 ${pendingProposals.length > 0
          ? fixedHeight
            ? pendingProposals.length >= 5
              ? "h-[360px] overflow-hidden"
              : ""
            : "max-h-[210px] overflow-y-auto scrollbar-thin scrollbar-track-gray-200 scrollbar-thumb-[#CCCCCC] scrollbar-w-[20px]"
          : "h-[200px]"
          }`}
      >
        {syncingState ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00000033] border-t-[#FF5500]"></div>
              <p className="text-[#00000099] font-dmmono text-sm font-[400]">
                Syncing proposals...
              </p>
            </div>
          </div>
        ) : pendingProposals.length > 0 ? (
          pendingProposals.map((proposal) => {
            const propThreshold = getEffectiveThreshold(
              proposal.metadata?.proposalType,
              effectiveThreshold,
              detectedConfig?.procedureThresholds
            );
            const sigCount = proposal.signatures?.length ?? 0;
            const isReady = sigCount >= propThreshold;
            const isSigning = signingProposal === proposal.id;
            const isExecuting = executingProposal === proposal.id;
            const isSend = proposal.metadata?.proposalType === 'p2id';

            return (
              <div
                key={proposal.id}
                className="flex h-[64px] w-full flex-row items-center border-[0.5px] border-[#00000033] flex-shrink-0"
              >
                <div className="font-dmmono w-[10%] text-center text-[12px] font-[400]">
                  {proposal.id.slice(0, 8)}...
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="font-dmmono w-[45%] pl-6 text-[12px] font-[400]">
                  <span className="font-dmmono text-[12px] font-[500]">
                    {proposal.metadata?.proposalType === 'p2id' ? 'SEND' :
                     proposal.metadata?.proposalType === 'consume_notes' ? 'RECEIVE' :
                     proposal.metadata?.proposalType === 'add_signer' ? 'ADD SIGNER' :
                     proposal.metadata?.proposalType === 'remove_signer' ? 'REMOVE SIGNER' :
                     proposal.metadata?.proposalType === 'change_threshold' ? 'CHANGE THRESHOLD' :
                     proposal.metadata?.proposalType === 'switch_psm' ? 'SWITCH PSM' :
                     (proposal.metadata?.proposalType ?? 'UNKNOWN').toUpperCase()}
                  </span>
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="justify-center items-center flex w-[10%] relative h-full">
                  <Image
                    src={isSend ? media.sendIcon : media.receiveIcon}
                    alt={isSend ? "send" : "receive"}
                    quality={100}
                    className="w-[25%] h-[55%]"
                  />
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="flex w-[15%] space-x-1 flex-row items-center justify-center">
                  <span className="text-[12px] font-dmmono font-[400]">
                    {sigCount}/{propThreshold} signed
                  </span>
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="flex items-center justify-center w-[10%]">
                  {isReady ? (
                    <div className="bg-[#28A857] text-white p-1.5 text-[8px] font-dmmono font-[400]">
                      READY
                    </div>
                  ) : (
                    <div className="bg-[#FF5500] text-white p-1.5 text-[8px] font-dmmono font-[400]">
                      {propThreshold - sigCount} NEEDED
                    </div>
                  )}
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                {isReady ? (
                  <button
                    onClick={() => handleExecute(proposal.id)}
                    disabled={isExecuting}
                    className={`w-[10%] text-center text-[12px] font-dmmono font-[400] ${
                      isExecuting ? "opacity-50 cursor-not-allowed" : "hover:bg-green-50 text-green-700"
                    }`}
                  >
                    {isExecuting ? (
                      <div className="flex items-center justify-center gap-1">
                        <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></div>
                        <span>...</span>
                      </div>
                    ) : (
                      "EXECUTE"
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSign(proposal.id)}
                    disabled={isSigning}
                    className={`w-[10%] text-center text-[12px] font-dmmono font-[400] ${
                      isSigning ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100"
                    }`}
                  >
                    {isSigning ? (
                      <div className="flex items-center justify-center gap-1">
                        <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></div>
                        <span>Signing...</span>
                      </div>
                    ) : (
                      "SIGN"
                    )}
                  </button>
                )}
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
              No pending proposals
            </p>
            <p className="text-gray-400 font-dmmono text-xs font-[400] mt-1">
              All proposals have been processed
            </p>
          </div>
        )}
      </div>

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
    </div>
  );
};

export default PendingActions;
