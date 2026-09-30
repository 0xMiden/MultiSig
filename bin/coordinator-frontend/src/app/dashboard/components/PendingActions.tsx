"use client";
import { ProposalDetails } from "@/components/ProposalDetails";
import React, { useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import media from "../../../../public/media";
import { useMultisig } from "@/contexts/MultisigContext";
import { PendingActionsProps } from "@/types";
import { getProposalActionState } from "@/lib/proposalActions";
import { ProposalActionButton } from "@/components/ProposalActionButton";

const PendingActions: React.FC<PendingActionsProps> = ({ threshold, fixedHeight = false }) => {
  const router = useRouter();
  const {
    proposals,
    detectedConfig,
    activeCommitment,
    syncingState,
  } = useMultisig();

  // Filter to only show pending (not yet executed) proposals
  const pendingProposals = useMemo(() => {
    return proposals.filter(p => p.status === 'pending' || p.status === 'ready');
  }, [proposals]);

  const handleViewAll = () => {
    router.push('/dashboard/transactions');
  };

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 w-full">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[#00000099] text-[16px]">
          PENDING ACTIONS
        </div>
        {fixedHeight && (
          <button
            onClick={handleViewAll}
            className="font-[500] text-[#000000] text-[10px] italic hover:text-[#FF5500] transition-colors cursor-pointer"
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
              <p className="text-[#00000099] text-sm font-[400]">
                Syncing proposals...
              </p>
            </div>
          </div>
        ) : pendingProposals.length > 0 ? (
          pendingProposals.map((proposal) => {
            const action = getProposalActionState(
              proposal,
              detectedConfig,
              activeCommitment,
              threshold ?? 0,
            );
            const isSend = proposal.metadata?.proposalType === 'p2id';

            return (
              <div
                key={proposal.id}
                className="flex min-h-[64px] w-full flex-row items-center border border-[rgba(0,0,0,0.08)] rounded-[8px] shrink-0 overflow-hidden"
              >
                <div className="w-[10%] text-center text-[12px] font-[400]">
                  {proposal.id.slice(0, 8)}...
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="w-[45%] pl-6 text-[12px] font-[400]">
                  <span className="text-[12px] font-[500]">
                    {proposal.metadata?.proposalType === 'p2id' ? 'SEND' :
                     proposal.metadata?.proposalType === 'consume_notes' ? 'RECEIVE' :
                     proposal.metadata?.proposalType === 'add_signer' ? 'ADD SIGNER' :
                     proposal.metadata?.proposalType === 'remove_signer' ? 'REMOVE SIGNER' :
                     proposal.metadata?.proposalType === 'change_threshold' ? 'CHANGE THRESHOLD' :
                     proposal.metadata?.proposalType === 'switch_guardian' ? 'SWITCH GUARDIAN' :
                     (proposal.metadata?.proposalType ?? 'UNKNOWN').toUpperCase()}
                  </span>
                  <ProposalDetails proposal={proposal} />
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
                  <span className="text-[12px] font-[400]">
                    {action.signatureCount}/{action.requiredSignatures || "—"} signed
                  </span>
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="flex items-center justify-center w-[10%]">
                  <div
                    title={action.statusLabel}
                    className={`px-2 py-1 text-center text-[8px] font-[500] rounded-full ${
                      action.action === "execute"
                        ? "bg-[#28A857] text-white"
                        : proposal.verification.status === "failed"
                          ? "bg-red-50 text-red-700"
                          : "bg-[#FF5500] text-white"
                    }`}
                  >
                    {action.action === "execute"
                      ? "READY"
                      : proposal.verification.status === "failed"
                        ? "CHECK"
                        : `${Math.max(0, action.requiredSignatures - action.signatureCount)} NEEDED`}
                  </div>
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <ProposalActionButton proposal={proposal} className="mx-1 w-[10%] px-1" />
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
            <p className="text-gray-500 text-sm font-[400]">
              No pending proposals
            </p>
            <p className="text-gray-400 text-xs font-[400] mt-1">
              All proposals have been processed
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingActions;
