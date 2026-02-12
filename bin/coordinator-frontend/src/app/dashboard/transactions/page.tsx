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
    <div className="flex flex-col p-2 w-[calc(100vw-150px)] font-dmmono">
      {/*Heading*/}
      <div className="p-2">
        <div className="text-[#000000] text-[24px] font-[500] font-dmmono">
          TRANSACTION HISTORY
        </div>
        <div className="text-[16px] text-[#0000007A] font-dmmono font-[500]">
          Complete record of your wallet history
        </div>
      </div>
      {/*Top Cards Div*/}
      <div className="grid grid-cols-12 gap-10 p-2">
        {/*Total Transactions Div*/}
        <div className="col-span-4 flex flex-col justify-between h-[135px] border-[0.5px] border-[#00000033] p-3">
          <div className="flex items-left space-x-2 font-dmmono text-black">
            <Image
              src={media.totalTransactionsIcon}
              alt="totalTransactionsIcon"
              quality={100}
            />
            <div className="font-dmmono text-[16px] text-[#000000] font-[500]">
              Total Proposals
            </div>
          </div>
          <div>
            <div className=" text-[24px] font-[500] font-dmmono text-[#000000]">
              {stats.total}
            </div>
            <div className="text-sm text-gray-700">All Time</div>
          </div>
        </div>
        {/*Pending Div*/}
        <div className="col-span-4 flex flex-col justify-between h-[135px] border-[0.5px] border-[#00000033] p-3">
          <div className="flex items-left space-x-2 font-dmmono text-black">
            <Image
              src={media.thisMonthIcon}
              alt="thisMonthIcon"
              quality={100}
            />
            <div className="font-dmmono text-[16px] text-[#000000] font-[500]">
              Pending
            </div>
          </div>
          <div>
            <div className=" text-[24px] font-[500] font-dmmono text-[#000000]">
              {stats.pending}
            </div>
            <div className="text-sm text-gray-700">Awaiting signatures</div>
          </div>
        </div>
        {/*Success Rate Div*/}
        <div className="col-span-4 flex flex-col justify-between h-[135px] border-[0.5px] border-[#00000033] p-3">
          <div className="flex items-left space-x-2 font-dmmono text-black">
            <Image src={media.assetValIcon} alt="assetValIcon" quality={100} />
            <div className="font-dmmono text-[16px] text-[#000000] font-[500]">
              Execution Rate
            </div>
          </div>
          <div>
            <div className=" text-[24px] font-[500] font-dmmono text-[#000000]">
              {stats.successRate}%
            </div>
            <div className="text-sm text-gray-700">{stats.executed}/{stats.total} Executed</div>
          </div>
        </div>
      </div>

      {/*Pending Actions Div*/}
      <div className="p-2">
        <PendingActions threshold={threshold} fixedHeight={false} />
      </div>
      {/*Recent Transactions Div*/}
      <div className="p-2">
        <RecentTransactions threshold={threshold} fixedHeight={false} />
      </div>
    </div>
  );
};

export default Transactions;
