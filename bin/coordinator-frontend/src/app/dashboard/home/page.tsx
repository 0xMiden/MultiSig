"use client";
import React, { useMemo, useState } from "react";
import Image from "next/image";
import assetValIcon from "../../../../public/media/home/circum_dollar.svg";

import PendingActions from "../components/PendingActions";
import RecentTransactions from "../components/RecentTransactions";
import { useMultisig } from "@/contexts/MultisigContext";

export const dynamic = 'force-dynamic';

import { AnimatePresence, motion } from "framer-motion";
import InitiateFundTransfer from "@/interactions/InitiateFundTransfer";
import ReceiveFundTransfer from "@/interactions/ReceiveFundTransfer";
import { ApproveFundTransfer } from "@/interactions/ApproveFundTransfer";

const Page: React.FC = () => {
  const { detectedConfig, proposals, syncingState } = useMultisig();
  const [isInitiateFundTransferOpen, setIsInitiateFundTransferOpen] = useState(false);
  const [isReceiveFundTransferOpen, setIsReceiveFundTransferOpen] = useState(false);
  const [isApproveFundTransferOpen, setIsApproveFundTransferOpen] = useState(false);

  const walletName = useMemo(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem("walletFormData") : null;
    if (saved) {
      try { return JSON.parse(saved).walletName || "Multisig Wallet"; } catch { return "Multisig Wallet"; }
    }
    return "Multisig Wallet";
  }, []);

  const threshold = detectedConfig?.threshold ?? 0;
  const signerCount = detectedConfig?.signerCommitments?.length ?? 0;
  const vaultBalances = detectedConfig?.vaultBalances ?? [];

  const totalBalance = useMemo(() => {
    if (vaultBalances.length === 0) return 0;
    const total = vaultBalances.reduce((sum, b) => sum + Number(b.amount), 0);
    return total / 1000000;
  }, [vaultBalances]);

  return (
    <div className="flex flex-col w-full h-full">
      {/*Top Cards Div*/}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6 px-2 py-2 md:py-3 lg:p-4">
        {/*Total Asset Value Div*/}
        <div className="col-span-4 flex flex-col h-[140px] md:h-[160px] border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4 md:p-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[#FF5500]/10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px]">
                <circle cx="12" cy="12" r="9"/>
                <path d="M14.5 9a2.5 2.5 0 0 0-2.5-2h-1a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-1a2.5 2.5 0 0 1-2.5-2"/>
                <line x1="12" y1="6" x2="12" y2="7"/>
                <line x1="12" y1="17" x2="12" y2="18"/>
              </svg>
            </div>
            <div className="font-geist text-[14px] md:text-[15px] text-[#111] font-[600]">
              Total Asset Value
            </div>
          </div>
          <div className="flex flex-col gap-1 mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] font-geist text-[#111] leading-none">
              {totalBalance.toFixed(2)}
            </div>
            <div className="text-[11px] md:text-[12px] font-geist text-[rgba(0,0,0,0.45)]">
              {vaultBalances.length} token(s) in vault
            </div>
          </div>
        </div>
        {/*Overview Div*/}
        <div className="col-span-4 flex flex-col h-[140px] md:h-[160px] border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4 md:p-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[#FF5500]/10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px]">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <div className="font-geist text-[14px] md:text-[15px] text-[#111] font-[600]">
              Overview
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex items-center justify-between">
              <div className="text-[12px] md:text-[13px] font-[500] font-geist text-[#111]">Wallet Name</div>
              <div className="text-[12px] md:text-[13px] text-[rgba(0,0,0,0.55)] font-geist">
                {walletName}
              </div>
            </div>
            <div className="h-px w-full bg-[rgba(0,0,0,0.06)]"></div>
            <div className="flex items-center justify-between">
              <div className="text-[12px] md:text-[13px] font-[500] font-geist text-[#111]">Signers</div>
              <div className="text-[12px] md:text-[13px] text-[rgba(0,0,0,0.55)] font-geist">
                {signerCount}
              </div>
            </div>
            <div className="h-px w-full bg-[rgba(0,0,0,0.06)]"></div>
            <div className="flex items-center justify-between">
              <div className="text-[12px] md:text-[13px] font-[500] font-geist text-[#111]">Threshold</div>
              <div className="text-[12px] md:text-[13px] text-[rgba(0,0,0,0.55)] font-geist">
                {threshold > 0 ? `${threshold} of ${signerCount} signatures` : "N/A"}
              </div>
            </div>
          </div>
        </div>
        {/*Actions Div*/}
        <div className="col-span-4 flex flex-col h-[140px] md:h-[160px]">
          <div className="flex flex-col justify-between gap-2 items-left space-x-2 h-full font-medium font-geist text-black">

            <div className="flex flex-col gap-2 h-full">
              <div className="flex flex-row gap-2 h-1/2">
                <button
                  className="w-1/2 relative group overflow-hidden border-[0.5px] border-[#00000033] rounded-[10px] py-1 px-2 text-[14px] md:text-[16px] text-[#000000] font-[400]"
                  onClick={() => setIsInitiateFundTransferOpen(true)}
                >
                  <span className="absolute inset-0 bg-[#FF5500] transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100"></span>
                  <span className="relative z-1 transition-colors duration-300 group-hover:text-white">
                    Send
                  </span>
                </button>
                <button
                  className="w-1/2 relative group overflow-hidden border-[0.5px] border-[#00000033] rounded-[10px] py-1 px-2 text-[14px] md:text-[16px] text-[#000000] font-[400]"
                  onClick={() => setIsReceiveFundTransferOpen(true)}
                >
                  <span className="absolute inset-0 bg-[#FF5500] transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100"></span>
                  <span className="relative z-1 transition-colors duration-300 group-hover:text-white">
                    Receive
                  </span>
                </button>
              </div>
              <button
                className="w-full relative group overflow-hidden h-1/2 border-[0.5px] border-[#00000033] rounded-[10px] py-1 px-2 text-[12px] md:text-[16px] text-[#000000] font-[400]"
                onClick={() => setIsApproveFundTransferOpen(true)}
              >
                <span className="absolute inset-0 bg-[#FF5500] transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100"></span>
                <span className="relative z-1 transition-colors duration-300 group-hover:text-white">
                  Approve queued transfers
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/*Pending Actions Div*/}
      <div className="p-2 md:p-4">
        <PendingActions
          threshold={threshold}
          fixedHeight={true}
        />
      </div>
      {/*Recent Transactions Div*/}
      <div className="p-2 md:p-4 flex-1">
        <RecentTransactions threshold={threshold} fixedHeight={true} />
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
