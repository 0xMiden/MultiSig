"use client";
import React from "react";
import Image from "next/image";
import media from "../../../../public/media";
import PendingActions from "../components/PendingActions";
import RecentTransactions from "../components/RecentTransactions";
import { useMultisig } from "@/contexts/MultisigContext";
import { useActivity } from "@/hooks/useActivity";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const Transactions: React.FC = () => {
  const { detectedConfig } = useMultisig();
  const threshold = detectedConfig?.threshold ?? 0;

  // Chain-first: a transaction is on chain (counted from the node's record of the
  // account), a proposal is anything not committed yet (Guardian's live list).
  // Per-browser history is not a source of counts. See `@/lib/history/summary`.
  const { stats } = useActivity();

  return (
    <div className="flex flex-col p-4 w-full">
      {/* Heading */}
      <div className="mb-4">
        <div className="text-[22px] md:text-[24px] font-[600] text-[#111]">
          Transaction History
        </div>
        <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
          Proposals awaiting signatures, and every transaction the node recorded for this account
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6 mb-6">
        {/* Total Proposals */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 h-[140px] md:h-[160px]">
          <div className="flex items-center gap-2">
            <div className="bg-[#FF5500]/10 rounded-[8px] w-7 h-7 flex items-center justify-center shrink-0">
              <Image src={media.totalTransactionsIcon} alt="total" quality={100} width={16} height={16} />
            </div>
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
              Transactions
            </div>
          </div>
          <div className="mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] text-[#111]">
              {stats.transactions}
            </div>
            <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.45)]">On chain, all time</div>
          </div>
        </div>

        {/* Pending */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 h-[140px] md:h-[160px]">
          <div className="flex items-center gap-2">
            <div className="bg-[#FF5500]/10 rounded-[8px] w-7 h-7 flex items-center justify-center shrink-0">
              <Image src={media.thisMonthIcon} alt="pending" quality={100} width={16} height={16} />
            </div>
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
              Proposals
            </div>
          </div>
          <div className="mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] text-[#111]">
              {stats.proposals}
            </div>
            <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.45)]">Not on chain yet</div>
          </div>
        </div>

        {/* Execution Rate */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 h-[140px] md:h-[160px]">
          <div className="flex items-center gap-2">
            <div className="bg-[#FF5500]/10 rounded-[8px] w-7 h-7 flex items-center justify-center shrink-0">
              <Image src={media.assetValIcon} alt="rate" quality={100} width={16} height={16} />
            </div>
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
              Execution Rate
            </div>
          </div>
          <div className="mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] text-[#111]">
              {stats.executionRate}%
            </div>
            <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.45)]">{stats.transactions} of {stats.transactions + stats.proposals} executed</div>
          </div>
        </div>
      </div>

      {/* Pending Actions */}
      <div className="mb-4">
        <PendingActions threshold={threshold} fixedHeight={false} />
      </div>

      {/* Recent Transactions */}
      <RecentTransactions threshold={threshold} fixedHeight={false} />
    </div>
  );
};

export default Transactions;
