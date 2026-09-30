"use client";
import React, { useMemo } from "react";
import Image from "next/image";
import media from "../../../../public/media";
import PendingActions from "../components/PendingActions";
import RecentTransactions from "../components/RecentTransactions";
import { useMultisig } from "@/contexts/MultisigContext";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const Transactions: React.FC = () => {
  const { proposals, detectedConfig } = useMultisig();

  const threshold = detectedConfig?.threshold ?? 0;

  const stats = useMemo(() => {
    const total = proposals.length;
    const executed = proposals.filter(p => p.status === 'finalized').length;
    const pending = proposals.filter(p => p.status === 'pending' || p.status === 'ready').length;
    const successRate = total > 0 ? Math.round((executed / total) * 100) : 0;
    return { total, executed, pending, successRate };
  }, [proposals]);

  return (
    <div className="flex flex-col p-4 w-full">
      {/* Heading */}
      <div className="mb-4">
        <div className="text-[22px] md:text-[24px] font-[600] text-[#111]">
          Transaction History
        </div>
        <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
          Complete record of your wallet history
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
              Total Proposals
            </div>
          </div>
          <div className="mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] text-[#111]">
              {stats.total}
            </div>
            <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.45)]">All time</div>
          </div>
        </div>

        {/* Pending */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 h-[140px] md:h-[160px]">
          <div className="flex items-center gap-2">
            <div className="bg-[#FF5500]/10 rounded-[8px] w-7 h-7 flex items-center justify-center shrink-0">
              <Image src={media.thisMonthIcon} alt="pending" quality={100} width={16} height={16} />
            </div>
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
              Pending
            </div>
          </div>
          <div className="mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] text-[#111]">
              {stats.pending}
            </div>
            <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.45)]">Awaiting signatures</div>
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
              {stats.successRate}%
            </div>
            <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.45)]">{stats.executed}/{stats.total} executed</div>
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
