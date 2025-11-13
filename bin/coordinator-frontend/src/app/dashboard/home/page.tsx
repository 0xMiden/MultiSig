"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import assetValIcon from "../../../../public/media/home/circum_dollar.svg";

import PendingActions from "../components/PendingActions";
import RecentTransactions from "../components/RecentTransactions";
import { useAppDispatch } from "../../../store/hooks";
import { useWalletData } from "../../../hooks/useWalletData";

import {
  fetchPendingTransactions,
  fetchConfirmedTransactions,
} from "../../../services/transactionApi";

export const dynamic = 'force-dynamic';

import { AnimatePresence, motion } from "framer-motion";
import InitiateFundTransfer from "@/interactions/InitiateFundTransfer";
import { useFungibleAssets } from "@/hooks/useFungibleAssets";
import ReceiveFundTransfer from "@/interactions/ReceiveFundTransfer";
import { ApproveFundTransfer } from "@/interactions/ApproveFundTransfer";

const Page: React.FC = () => {
  const dispatch = useAppDispatch();
  const { walletData, loading, error } = useWalletData();
  const { fungibleAssets, isLoading: isLoadingAssets, getFungibleAssets } = useFungibleAssets();
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [isInitiateFundTransferOpen, setIsInitiateFundTransferOpen] =
    useState(false);
  const [isReceiveFundTransferOpen, setIsReceiveFundTransferOpen] =
    useState(false);
  const [isApproveFundTransferOpen, setIsApproveFundTransferOpen] =
    useState(false);


  useEffect(() => {
    const walletId = localStorage.getItem("currentWalletId");
    if (walletId) {
      dispatch(fetchPendingTransactions({ accountId: walletId }));
      dispatch(fetchConfirmedTransactions({ accountId: walletId }));
    }
  }, []);

  // Calculate total balance from fungible assets
  useEffect(() => {
    if (fungibleAssets.length > 0) {
      const totalBalanceBigInt = fungibleAssets.reduce((sum, asset) => sum + BigInt(asset.balance), BigInt(0));
      const totalBalanceDisplay = Number(totalBalanceBigInt) / 1000000;
      setTotalBalance(totalBalanceDisplay);
    } else {
      setTotalBalance(0);
    }
  }, [fungibleAssets]);

  return (
    <div className="flex flex-col w-full h-full">
      {/*Top Cards Div*/}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6 px-2 py-2 md:py-3 lg:p-4">
        {/*Total Asset Value Div*/}
        <div className="col-span-4 flex flex-col justify-between h-[100px] md:h-[135px] border-[0.5px] border-[#00000033] p-2 md:p-3">
          <div className="flex items-left space-x-2 font-dmmono text-black">
            <Image src={assetValIcon} alt="assetValIcon" quality={100} />
            <div className="font-dmmono text-[14px] md:text-[16px] text-[#000000] font-[500]">
              Total Asset Value
            </div>
          </div>
          <div>
            <div className="text-[18px] md:text-[24px] font-[500] font-dmmono text-[#000000]">
              {totalBalance.toFixed(2)}
            </div>
            <div className="text-xs md:text-sm text-gray-700">≈ ${totalBalance.toFixed(2)} USD</div>
          </div>
        </div>
        {/*Overview Div*/}
        <div className="col-span-4 flex flex-col h-[100px] md:h-[135px] border-[0.5px] border-[#00000033] p-2 md:p-3">
          <div className="flex flex-col items-left space-x-2 font-dmmono text-black">
            <div className="flex items-left space-x-2">
              <Image src={assetValIcon} alt="assetValIcon" quality={100} />
              <div className="font-dmmono text-[14px] md:text-[16px] text-[#000000] font-[500]">
                Overview
              </div>
            </div>
            <div className="flex flex-col p-1 md:p-2 gap-1 md:gap-2">
              <div className="flex items-center justify-between border-b-[0.5px]">
                <div className="text-[8px] md:text-[10px] font-[500] font-dmmono">Wallet Name</div>
                <div className="text-[8px] md:text-[10px] text-[#0000008C] font-[500] font-dmmono">
                  {loading ? "Loading..." : error ? "-" : walletData?.walletFormData?.walletName || "Multisig Wallet"}
                </div>
              </div>
              <div className="flex items-center justify-between border-b-[0.5px]">
                <div className="text-[8px] md:text-[10px] font-[500] font-dmmono">Kind</div>
                <div className="text-[8px] md:text-[10px] text-[#0000008C] font-[500] font-dmmono">
                  {loading ? "Loading..." : error ? "-" : walletData?.kind || "N/A"}
                </div>
              </div>
              <div className="flex items-center justify-between border-b-[0.5px]">
                <div className="text-[8px] md:text-[10px] font-[500] font-dmmono">Threshold</div>
                <div className="text-[8px] md:text-[10px] text-[#0000008C] font-[500] font-dmmono">
                  {loading
                    ? "Loading..."
                    : error
                      ? "-"
                      : walletData
                        ? `${walletData.threshold} of ${walletData.approver_number} signatures`
                        : "N/A"}
                </div>
              </div>


            </div>
          </div>
        </div>
        {/*Actions Div*/}
        <div className="col-span-4 flex flex-col h-[100px] md:h-[135px]">
          <div className="flex flex-col justify-between gap-2 items-left space-x-2 h-full font-medium font-dmmono text-black">

            <div className="flex flex-col gap-2 h-full">
              <div className="flex flex-row gap-2 h-1/2">
                <button
                  className="w-1/2 relative group overflow-hidden border-[0.5px] border-[#00000033] py-1 px-2 text-[14px] md:text-[16px] text-[#000000] font-[400]"
                  onClick={() => setIsInitiateFundTransferOpen(true)}
                >
                  <span className="absolute inset-0 bg-[#FF5500] transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100"></span>
                  <span className="relative z-1 transition-colors duration-300 group-hover:text-white">
                    SEND
                  </span>
                </button>
                <button
                  className="w-1/2 relative group overflow-hidden border-[0.5px] border-[#00000033] py-1 px-2 text-[14px] md:text-[16px] text-[#000000] font-[400]"
                  onClick={() => setIsReceiveFundTransferOpen(true)}
                >
                  <span className="absolute inset-0 bg-[#FF5500] transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100"></span>
                  <span className="relative z-1 transition-colors duration-300 group-hover:text-white">
                    RECEIVE
                  </span>
                </button>
              </div>
              <button
                className="w-full relative group overflow-hidden h-1/2 border-[0.5px] border-[#00000033] py-1 px-2 text-[12px] md:text-[16px] text-[#000000] font-[400]"
                onClick={() => setIsApproveFundTransferOpen(true)}
              >
                <span className="absolute inset-0 bg-[#FF5500] transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100"></span>
                <span className="relative z-1 transition-colors duration-300 group-hover:text-white">
                  APPROVE QUEUED TRANSFERS
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/*Pending Actions Div*/}
      <div className="p-2 md:p-4">
        <PendingActions
          threshold={walletData?.threshold}
          fixedHeight={true}
        />
      </div>
      {/*Recent Transactions Div*/}
      <div className="p-2 md:p-4 flex-1">
        <RecentTransactions threshold={walletData?.threshold || 0} fixedHeight={true} />
      </div>

      {/* initiate fund transfer interactions is being called here  */}

      <AnimatePresence>
        {isInitiateFundTransferOpen && (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#FBFCFD]/60 backdrop-blur-sm"
            onClick={() => setIsInitiateFundTransferOpen(false)}
          >
            <motion.div
              key="modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 8, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <InitiateFundTransfer
                onCancel={() => setIsInitiateFundTransferOpen(false)}
                fungibleAssets={fungibleAssets}
                isLoading={isLoadingAssets}
                onOpen={getFungibleAssets}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Receive Fund Transfer Modal */}
      <AnimatePresence>
        {isReceiveFundTransferOpen && (
          <motion.div
            key="receive-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#FBFCFD]/60 backdrop-blur-sm"
            onClick={() => setIsReceiveFundTransferOpen(false)}
          >
            <motion.div
              key="receive-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 8, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <ReceiveFundTransfer
                onCancel={() => setIsReceiveFundTransferOpen(false)}
                onAssetsUpdated={getFungibleAssets}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Approve Fund Transfer Modal */}
      <AnimatePresence>
        {isApproveFundTransferOpen && (
          <motion.div
            key="approve-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#FBFCFD]/60 backdrop-blur-sm"
            onClick={() => setIsApproveFundTransferOpen(false)}
          >
            <motion.div
              key="approve-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 8, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <ApproveFundTransfer
                onCancel={() => setIsApproveFundTransferOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>




    </div>
  );
};

export default Page;
