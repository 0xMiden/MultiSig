"use client";
import { TokenAmount } from "@/components/TokenAmount";
import React, { useMemo, useState } from "react";

import PendingActions from "../components/PendingActions";
import RecentTransactions from "../components/RecentTransactions";
import { useMultisig } from "@/contexts/MultisigContext";
import { useDashboardUI } from "@/contexts/DashboardUIContext";
import ApproveModal from "./components/ApproveModal";

export const dynamic = 'force-dynamic';

const Page: React.FC = () => {
  const { detectedConfig } = useMultisig();
  const { openSendModal, openReceiveModal } = useDashboardUI();
  const [isApproveOpen, setIsApproveOpen] = useState(false);

  const walletName = useMemo(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem("walletFormData") : null;
    if (saved) {
      try { return JSON.parse(saved).walletName || "Multisig Wallet"; } catch { return "Multisig Wallet"; }
    }
    return "Multisig Wallet";
  }, []);

  const threshold = detectedConfig?.threshold ?? 0;
  const signerCount = detectedConfig?.signerCommitments?.length ?? 0;
  const vaultBalances = useMemo(
    () => detectedConfig?.vaultBalances ?? [],
    [detectedConfig?.vaultBalances],
  );

  // Different tokens are never added together: each has its own decimals and
  // value. The card shows the first token and counts the rest.
  const [firstBalance, ...otherBalances] = vaultBalances;

  return (
    <div className="flex flex-col w-full h-full">
      {/* Top stat cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 px-2 py-2 md:py-3 lg:p-4">

        {/* Total Asset Value */}
        <div className="col-span-4 flex flex-col justify-between h-[140px] md:h-[160px] rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-[#FF5500]/10 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-[#FF5500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">Balance</div>
          </div>
          <div>
            <div className="text-[22px] md:text-[26px] font-[600] text-[#111] leading-none break-all">
              {firstBalance ? <TokenAmount faucetId={firstBalance.faucetId} amount={firstBalance.amount} /> : "0"}
            </div>
            <div className="text-[12px] text-[rgba(0,0,0,0.4)] mt-1.5">
              {vaultBalances.length === 0
                ? "No tokens in vault"
                : otherBalances.length > 0
                  ? `and ${otherBalances.length} more token${otherBalances.length !== 1 ? "s" : ""}`
                  : "1 token in vault"}
            </div>
          </div>
        </div>

        {/* Overview */}
        <div className="col-span-4 flex flex-col h-[140px] md:h-[160px] rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-[8px] bg-[#FF5500]/10 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-[#FF5500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">Overview</div>
          </div>
          <div className="flex flex-col flex-1 justify-between">
            {[
              { label: "Wallet Name", value: walletName },
              { label: "Signers", value: String(signerCount) },
              { label: "Threshold", value: threshold > 0 ? `${threshold} of ${signerCount}` : "N/A" },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className={`flex items-center justify-between py-1 ${i < arr.length - 1 ? "border-b border-[rgba(0,0,0,0.06)]" : ""}`}
              >
                <div className="text-[12px] font-[500] text-[rgba(0,0,0,0.45)]">{row.label}</div>
                <div className="text-[12px] font-[500] text-[#111] truncate max-w-[120px] text-right">{row.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions — three white bordered cards, no orange fill */}
        <div className="col-span-4 flex flex-col h-[140px] md:h-[160px] gap-2">
          <div className="flex gap-2 flex-1">
            <button
              onClick={() => openSendModal()}
              className="flex-1 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white text-[14px] font-[500] text-[#111] hover:bg-gray-50 transition-colors"
            >
              Send
            </button>
            <button
              onClick={() => openReceiveModal()}
              className="flex-1 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white text-[14px] font-[500] text-[#111] hover:bg-gray-50 transition-colors"
            >
              Receive
            </button>
          </div>
          <button
            onClick={() => setIsApproveOpen(true)}
            className="w-full flex-1 rounded-[10px] border border-[rgba(0,0,0,0.08)] bg-white text-[14px] font-[500] text-[#111] hover:bg-gray-50 transition-colors"
          >
            Approve queued transfers
          </button>
        </div>
      </div>

      {/* Pending Actions */}
      <div className="p-2 md:p-4">
        <PendingActions threshold={threshold} fixedHeight={true} />
      </div>

      {/* Recent Transactions */}
      <div className="p-2 md:p-4 flex-1">
        <RecentTransactions threshold={threshold} fixedHeight={true} />
      </div>

      {/* Modal — Send/Receive are mounted globally in dashboard/layout.tsx so the chat assistant can open them from any page */}
      <ApproveModal open={isApproveOpen} onClose={() => setIsApproveOpen(false)} />
    </div>
  );
};

export default Page;
