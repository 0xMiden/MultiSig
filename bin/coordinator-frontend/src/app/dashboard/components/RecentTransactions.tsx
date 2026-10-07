"use client";
import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import media from "../../../../public/media";
import { useMultisig } from "@/contexts/MultisigContext";
import { RecentTransactionsProps } from "@/types";
import type { HistoryStatus } from "@/lib/proposalHistory";

const STATUS_STYLE: Record<HistoryStatus, { label: string; className: string }> = {
  executed: { label: "Executed", className: "text-[#28A857]" },
  pending: { label: "Pending", className: "text-[#FF5500]" },
  discarded: { label: "Discarded", className: "text-[rgba(0,0,0,0.4)]" },
};

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ fixedHeight = false }) => {
  const router = useRouter();
  const { proposalHistory, syncingState } = useMultisig();

  // Durable, decoded, newest-first history. Unlike the live `proposals` list,
  // this keeps executed/discarded proposals and shows a custom admin proposal's
  // real action (e.g. "Set max supply") instead of the opaque "custom".
  const entries = proposalHistory;

  const handleViewAll = () => {
    router.push('/dashboard/transactions');
  };

  return (
    <div className="flex flex-col gap-2 w-full border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="text-[16px] font-[500] text-[#00000099]">
          Recent Transactions
        </div>
        {fixedHeight && (
          <button
            onClick={handleViewAll}
            className="text-[10px] font-[500] text-[#000000] italic hover:text-[#FF5500] transition-colors cursor-pointer"
          >
            View all
          </button>
        )}
      </div>

      {/* Transactions */}
      <div
        className={`flex flex-col gap-3 ${entries.length > 0
          ? fixedHeight
            ? entries.length >= 5
              ? "h-[400px] overflow-hidden"
              : ""
            : "max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          : "h-[200px]"
          }`}
      >
        {syncingState && entries.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00000033] border-t-[#FF5500]"></div>
              <p className="text-[#00000099] text-sm font-[400]">
                Syncing...
              </p>
            </div>
          </div>
        ) : entries.length > 0 ? (
          entries.map((entry) => {
            const isSend = entry.proposalType === 'p2id';
            const status = STATUS_STYLE[entry.status];

            return (
              <div
                key={entry.id}
                className="flex h-[64px] w-full flex-row items-center relative border border-[rgba(0,0,0,0.08)] rounded-[8px] shrink-0"
              >
                <div className="font-geist w-[10%] text-center text-[12px] font-[400]">
                  {entry.id.slice(0, 8)}...
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="font-geist w-[45%] pl-6 text-[12px] font-[400]">
                  <span className="font-geist text-[12px] font-[500]">
                    {entry.description}
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
                  <span className="text-[12px] text-[#FF5500] font-[400]">
                    {entry.signatureCount}/{entry.requiredSignatures} signed
                  </span>
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
                <div className="w-[10%] text-center text-[12px] font-[400]">
                  <span className={`text-[10px] whitespace-nowrap ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <div className="h-full w-[0.5px] bg-[#00000033]"></div>
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
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-[400]">
              No recent transactions
            </p>
            <p className="text-gray-400 text-xs font-[400] mt-1">
              Your transaction history will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentTransactions;
