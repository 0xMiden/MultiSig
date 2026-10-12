"use client";
import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import media from "../../../../public/media";
import { isProposalActionable } from "@openzeppelin/miden-multisig-client";
import { useMultisig } from "@/contexts/MultisigContext";
import { useActivity } from "@/hooks/useActivity";
import { RecentTransactionsProps } from "@/types";

function formatTime(ts?: number): string {
  return ts ? new Date(ts * 1000).toLocaleString() : '';
}

const ROW = "flex h-[64px] w-full flex-row items-center relative border border-[rgba(0,0,0,0.08)] rounded-[8px] shrink-0";
const SEP = "h-full w-[0.5px] bg-[#00000033]";

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-[500] uppercase tracking-wide text-[rgba(0,0,0,0.45)] mt-1">{children}</div>;
}

/**
 * The account's activity, chain-first: live **proposals** (not committed yet, from Guardian) on
 * top, then the **transactions** the node recorded for the account, newest first. A transaction
 * is executed by definition, so it carries its block and time rather than a signature count.
 * Proposals this browser discarded locally are tucked behind a toggle.
 */
const RecentTransactions: React.FC<RecentTransactionsProps> = ({ fixedHeight = false }) => {
  const router = useRouter();
  const { proposals: live, handleCancelProposal, cancelingProposal, handleExecuteProposal, executingProposal } = useMultisig();
  const { transactions, proposals, discarded, loading, error } = useActivity();
  const [showDiscarded, setShowDiscarded] = useState(false);

  const count = proposals.length + transactions.length;
  const handleViewAll = () => router.push('/dashboard/transactions');

  return (
    <div className="flex flex-col gap-2 w-full border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="text-[16px] font-[500] text-[#00000099]">Recent Transactions</div>
        <div className="flex items-center gap-3">
          {discarded.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDiscarded((v) => !v)}
              className="text-[10px] font-[500] text-[rgba(0,0,0,0.5)] hover:text-[#FF5500] transition-colors cursor-pointer"
            >
              {showDiscarded ? 'Hide' : 'Show'} discarded ({discarded.length})
            </button>
          )}
          {fixedHeight && (
            <button
              onClick={handleViewAll}
              className="text-[10px] font-[500] text-[#000000] italic hover:text-[#FF5500] transition-colors cursor-pointer"
            >
              View all
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-red-700">Could not load the on-chain transactions: {error}</div>
      )}

      <div
        className={`flex flex-col gap-3 ${count > 0
          ? fixedHeight
            ? count >= 5
              ? "h-[400px] overflow-hidden"
              : ""
            : "max-h-[480px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          : "h-[200px]"
          }`}
      >
        {loading && count === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00000033] border-t-[#FF5500]"></div>
              <p className="text-[#00000099] text-sm font-[400]">Loading…</p>
            </div>
          </div>
        ) : count > 0 || (showDiscarded && discarded.length > 0) ? (
          <>
            {proposals.length > 0 && <GroupLabel>Proposals · not on chain yet</GroupLabel>}
            {proposals.map((p) => {
              const liveProposal = live.find((x) => x.id === p.id);
              const canRetry = !!liveProposal && isProposalActionable(liveProposal);
              const isRetrying = executingProposal === p.id;
              const isDiscarding = cancelingProposal === p.id;
              return (
                <div key={p.id} className={ROW}>
                  <div className="font-geist w-[10%] text-center text-[12px] font-[400]" title={p.id}>{p.id.slice(0, 8)}...</div>
                  <div className={SEP}></div>
                  <div className="font-geist w-[35%] pl-6 text-[12px] font-[500]">{p.title}</div>
                  <div className={SEP}></div>
                  <div className="justify-center items-center flex w-[10%] relative h-full">
                    <Image src={p.proposalType === 'p2id' ? media.sendIcon : media.receiveIcon} alt="" quality={100} className="w-[25%] h-[55%]" />
                  </div>
                  <div className={SEP}></div>
                  <div className="flex w-[15%] items-center justify-center">
                    <span className="text-[12px] text-[#FF5500] font-[400]">{p.signatureCount}/{p.requiredSignatures} signed</span>
                  </div>
                  <div className={SEP}></div>
                  <div className="w-[10%] text-center">
                    <span className="text-[10px] whitespace-nowrap text-[#FF5500]">Pending</span>
                  </div>
                  <div className={SEP}></div>
                  <div className="flex w-[10%] flex-row items-center justify-center gap-2 px-1">
                    {canRetry && (
                      <button
                        type="button"
                        onClick={() => handleExecuteProposal(p.id).catch(() => {})}
                        disabled={isRetrying || isDiscarding}
                        title="Retry: re-sync and re-execute this proposal at the current chain tip"
                        className="text-[10px] font-[500] text-[#FF5500] hover:text-[#cc4400] disabled:opacity-50 cursor-pointer"
                      >
                        {isRetrying ? '…' : 'Retry'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCancelProposal(p.id)}
                      disabled={isDiscarding || isRetrying}
                      title="Discard: mark this proposal terminal and release any account lock (this browser only — Guardian cannot propagate a discard to other signers)"
                      className="text-[10px] font-[500] text-red-600 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                    >
                      {isDiscarding ? '…' : 'Discard'}
                    </button>
                  </div>
                </div>
              );
            })}

            {transactions.length > 0 && <GroupLabel>Transactions · on chain</GroupLabel>}
            {transactions.map((t) => (
              <div key={t.txIdHex} className={ROW}>
                <div className="font-geist w-[10%] text-center text-[12px] font-[400]" title={t.txIdHex}>{t.txIdHex.slice(0, 8)}...</div>
                <div className={SEP}></div>
                <div className="font-geist w-[35%] pl-6 text-[12px] font-[500]">{t.title}</div>
                <div className={SEP}></div>
                <div className="justify-center items-center flex w-[10%] relative h-full">
                  <Image src={t.isSend ? media.sendIcon : media.receiveIcon} alt="" quality={100} className="w-[25%] h-[55%]" />
                </div>
                <div className={SEP}></div>
                <div className="flex w-[15%] flex-col items-center justify-center text-[11px] text-[rgba(0,0,0,0.55)] leading-tight">
                  <span>block {t.blockNum}</span>
                  {t.timestamp ? <span>{formatTime(t.timestamp)}</span> : null}
                </div>
                <div className={SEP}></div>
                <div className="w-[10%] text-center">
                  <span className="text-[10px] whitespace-nowrap text-[#28A857]">Executed</span>
                </div>
                <div className={SEP}></div>
                <div className="flex w-[10%] items-center justify-center">
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/history')}
                    className="text-[10px] font-[500] text-[rgba(0,0,0,0.5)] hover:text-[#FF5500] cursor-pointer"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}

            {showDiscarded && discarded.length > 0 && <GroupLabel>Discarded in this browser</GroupLabel>}
            {showDiscarded && discarded.map((d) => (
              <div key={d.id} className={`${ROW} opacity-60`}>
                <div className="font-geist w-[10%] text-center text-[12px] font-[400]" title={d.id}>{d.id.slice(0, 8)}...</div>
                <div className={SEP}></div>
                <div className="font-geist w-[35%] pl-6 text-[12px] font-[500]">{d.description}</div>
                <div className={SEP}></div>
                <div className="w-[10%]"></div>
                <div className={SEP}></div>
                <div className="flex w-[15%] items-center justify-center">
                  <span className="text-[12px] text-[rgba(0,0,0,0.5)] font-[400]">{d.signatureCount}/{d.requiredSignatures} signed</span>
                </div>
                <div className={SEP}></div>
                <div className="w-[10%] text-center">
                  <span className="text-[10px] whitespace-nowrap text-[rgba(0,0,0,0.4)]">Discarded</span>
                </div>
                <div className={SEP}></div>
                <div className="w-[10%]"></div>
              </div>
            ))}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-[400]">No transactions yet</p>
            <p className="text-gray-400 text-xs font-[400] mt-1">Proposals and on-chain transactions will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentTransactions;
