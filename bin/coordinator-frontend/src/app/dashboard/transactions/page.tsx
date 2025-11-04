"use client";
import React, { useEffect } from "react";
import Image from "next/image";
import media from "../../../../public/media";
import PendingActions from "../components/PendingActions";
import RecentTransactions from "../components/RecentTransactions";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { useWalletData } from "../../../hooks/useWalletData";
import { useFungibleAssets } from "../../../hooks/useFungibleAssets";

import {
  fetchPendingTransactions,
  fetchConfirmedTransactions,
  fetchTransactionStatsThunk,
} from "../../../services/transactionApi";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const Transactions: React.FC = () => {
  const dispatch = useAppDispatch();
  const { fungibleAssets } = useFungibleAssets();
  const { walletData } = useWalletData();
  const { stats, loading: statsLoading } = useAppSelector((state) => state.walletStats);

  useEffect(() => {
    const walletId = localStorage.getItem("currentWalletId");
    if (walletId) {
      dispatch(fetchPendingTransactions({ accountId: walletId }));
      dispatch(fetchConfirmedTransactions({ accountId: walletId }));
      dispatch(fetchTransactionStatsThunk({ accountId: walletId }));
    }
  }, [dispatch]);

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
        {/*Total Asset Value Div*/}
        <div className="col-span-4 flex flex-col justify-between h-[135px] border-[0.5px] border-[#00000033] p-3">
          <div className="flex items-left space-x-2 font-dmmono text-black">
            <Image
              src={media.totalTransactionsIcon}
              alt="totalTransactionsIcon"
              quality={100}
            />
            <div className="font-dmmono text-[16px] text-[#000000] font-[500]">
              Total Transactions
            </div>
          </div>
          <div>
            <div className=" text-[24px] font-[500] font-dmmono text-[#000000]">
              {statsLoading ? "..." : stats?.total || 0}
            </div>
            <div className="text-sm text-gray-700">All Time</div>
          </div>
        </div>
        {/*This Month Div*/}
        <div className="col-span-4 flex flex-col justify-between h-[135px] border-[0.5px] border-[#00000033] p-3">
          <div className="flex items-left space-x-2 font-dmmono text-black">
            <Image
              src={media.thisMonthIcon}
              alt="thisMonthIcon"
              quality={100}
            />
            <div className="font-dmmono text-[16px] text-[#000000] font-[500]">
              This Month
            </div>
          </div>
          <div>
            <div className=" text-[24px] font-[500] font-dmmono text-[#000000]">
              {statsLoading ? "..." : stats?.last_month || 0}
            </div>
            <div className="text-sm text-gray-700">Last 30 days</div>
          </div>
        </div>
        {/*Success Rate Div*/}
        <div className="col-span-4 flex flex-col justify-between h-[135px] border-[0.5px] border-[#00000033] p-3">
          <div className="flex items-left space-x-2 font-dmmono text-black">
            <Image src={media.assetValIcon} alt="assetValIcon" quality={100} />
            <div className="font-dmmono text-[16px] text-[#000000] font-[500]">
              Success Rate
            </div>
          </div>
          <div>
            <div className=" text-[24px] font-[500] font-dmmono text-[#000000]">
              {statsLoading ? "..." : stats?.total ? Math.round((stats.total_success / stats.total) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-700">{stats?.total_success || 0}/{stats?.total || 0} Success</div>
          </div>
        </div>
      </div>

      {/*Pending Actions Div*/}
      <div className="p-2">
        <PendingActions threshold={walletData?.threshold} fixedHeight={false} />
      </div>
      {/*Recent Transactions Div*/}
      <div className="p-2">
        <RecentTransactions threshold={walletData?.threshold || 0} fixedHeight={false} />
      </div>
    </div>
  );
};

export default Transactions;
