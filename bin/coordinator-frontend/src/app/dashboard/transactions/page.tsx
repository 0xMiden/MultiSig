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
    const executed = proposals.filter(p => p.status.type === 'finalized').length;
    const pending = proposals.filter(p => p.status.type === 'pending' || p.status.type === 'ready').length;
    const successRate = total > 0 ? Math.round((executed / total) * 100) : 0;
    return { total, executed, pending, successRate };
  }, [proposals]);

  return (
    <div className="flex flex-col p-4 w-full font-geist">
      {/*Heading*/}
      <div className="mb-4">
        <div className="text-[#111] text-[22px] md:text-[24px] font-[600] font-geist">
          Transaction History
        </div>
        <div className="text-[13px] md:text-[14px] text-[rgba(0,0,0,0.5)] font-geist font-[400] mt-1">
          Complete record of your wallet history
        </div>
      </div>
      {/*Top Cards Div*/}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6">
        {/*Total Transactions Div*/}
        <div className="col-span-4 flex flex-col h-[140px] md:h-[160px] border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4 md:p-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[#FF5500]/10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px]">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </div>
            <div className="font-geist text-[14px] md:text-[15px] text-[#111] font-[600]">
              Total Proposals
            </div>
          </div>
          <div className="flex flex-col gap-1 mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] font-geist text-[#111] leading-none">
              {stats.total}
            </div>
            <div className="text-[11px] md:text-[12px] font-geist text-[rgba(0,0,0,0.45)]">
              All time
            </div>
          </div>
        </div>
        {/*Pending Div*/}
        <div className="col-span-4 flex flex-col h-[140px] md:h-[160px] border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4 md:p-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[#FF5500]/10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px]">
                <circle cx="12" cy="12" r="9"/>
                <polyline points="12 7 12 12 15 14"/>
              </svg>
            </div>
            <div className="font-geist text-[14px] md:text-[15px] text-[#111] font-[600]">
              Pending
            </div>
          </div>
          <div className="flex flex-col gap-1 mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] font-geist text-[#111] leading-none">
              {stats.pending}
            </div>
            <div className="text-[11px] md:text-[12px] font-geist text-[rgba(0,0,0,0.45)]">
              Awaiting signatures
            </div>
          </div>
        </div>
        {/*Execution Rate Div*/}
        <div className="col-span-4 flex flex-col h-[140px] md:h-[160px] border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4 md:p-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[#FF5500]/10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px]">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div className="font-geist text-[14px] md:text-[15px] text-[#111] font-[600]">
              Execution Rate
            </div>
          </div>
          <div className="flex flex-col gap-1 mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] font-geist text-[#111] leading-none">
              {stats.successRate}%
            </div>
            <div className="text-[11px] md:text-[12px] font-geist text-[rgba(0,0,0,0.45)]">
              {stats.executed}/{stats.total} Executed
            </div>
          </div>
        </div>
      </div>

      {/*Pending Actions Div*/}
      <div className="mt-4">
        <PendingActions threshold={threshold} fixedHeight={false} />
      </div>
      {/*Recent Transactions Div*/}
      <div className="mt-4">
        <RecentTransactions threshold={threshold} fixedHeight={false} />
      </div>
    </div>
  );
};

export default Transactions;
