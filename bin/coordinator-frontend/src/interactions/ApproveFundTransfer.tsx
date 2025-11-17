"use client";
import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchPendingTransactions } from "../services/transactionApi";
import { TransferBox } from "../components/TransferBox";

export const ApproveFundTransfer = ({
  onCancel,
  threshold = 3,
}: {
  onCancel?: () => void;
  threshold?: number;
}) => {
  const dispatch = useAppDispatch();
  const { pendingTransactions, loading, error } = useAppSelector((state) => state.transaction);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  useEffect(() => {
    const walletId = localStorage.getItem("currentWalletId");
    if (walletId) {
      dispatch(fetchPendingTransactions({ accountId: walletId }));
    }
  }, [dispatch]);

  const handleSelectAll = () => {
    if (selectedTxIds.length === pendingTransactions.length) {
      setSelectedTxIds([]); // Deselect all
    } else {
      setSelectedTxIds(pendingTransactions.map(tx => tx.id)); 
    }
  };

  const handleTransactionSelect = (txId: string) => {
    setSelectedTxIds(prev => 
      prev.includes(txId) 
        ? prev.filter(id => id !== txId)  
        : [...prev, txId]                 
    );
  };

 

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="w-[80vh] space-y-4 border-[0.5px] border-[rgba(0,0,0,0.2)] p-[30px]">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5500] mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading pending transactions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="w-[617px] space-y-4 border-[0.5px] border-[rgba(0,0,0,0.2)] p-[30px]">
            <div className="text-center py-8">
              <p className="text-red-600">Error: {error}</p>
              <button 
                onClick={() => {
                  const walletId = localStorage.getItem("currentWalletId");
                  if (walletId) {
                    dispatch(fetchPendingTransactions({ accountId: walletId }));
                  }
                }}
                className="mt-2 px-4 py-2 bg-[#FF5500] text-white rounded hover:bg-[#E04A00]"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[90vw] max-h-[90vh] bg-[#FAFAFA] shadow-2xl border border-neutral-200 opacity-100">
      <div className="max-w-4xl mx-auto">
        <div className="w-[80vh] space-y-4 border-[0.5px] border-[rgba(0,0,0,0.2)] p-4">
          <div className="font-dbmono text-[20px] font-[500] text-[#000000]">
            APPROVE QUEUED TRANSFERS
          </div>

          {/* Full-width separator line */}
          <div className="border-[0.25px] h-0 w-full bg-[#00000033]"></div>

          <div className="flex flex-row items-center justify-between">
            <span className="font-dmmono text-[14px] font-[500] text-[rgba(0,0,0,1)] uppercase">
              pending your signature ({pendingTransactions.length})
            </span>

            <button
              onClick={handleSelectAll}
              className="bg-[#28A857] hover:bg-[#28A857]/80 text-[7.59px] text-white font-dmmono font-[500] px-2 py-1 transition-colors uppercase"
            >
              SIGN All Ready ({pendingTransactions.length})
            </button>
          </div>

          {pendingTransactions.length === 0 ? (
            <div className="text-center py-8 text-[#00000099]">
              No pending transactions to approve
            </div>
          ) : (
            <>
              <div className="flex flex-col space-y-4">
                {pendingTransactions.map((transaction, index) => (
                  <TransferBox
                    key={transaction.id}
                    transaction={transaction}
                    index={index}
                    threshold={threshold}
                    // onApprove={handleTransactionApprove}
                    isSelected={selectedTxIds.includes(transaction.id)}
                    onSelect={handleTransactionSelect}
                  />
                ))}
              </div>

              {selectedTxIds.length > 0 && (
                <div className="flex justify-center">
                  <button
                    // onClick={handleApproveSelected}
                    className="px-6 py-3 w-full bg-[#FF5500] text-white font-dmmono font-[500] hover:bg-[#E04A00] transition-colors"
                  >
                    SIGN SELECTED ({selectedTxIds.length})
                  </button>
                </div>
              )}
            </>
          )}

          <div className="w-full h-[78px] px-4 py-2 bg-[#FBE9EA] text-[#FF0000]">
            <span className="uppercase text-[16px] font-dmmono font-[500]">
              security notice
            </span>

            <div className="font-dmmono text-[12px] text-[#FF0000]">
              Please verify all transfer details carefully before approving.
              once executed, transfers cannot be reversed.
            </div>
          </div>

          <div
            className="w-full text-center uppercase text-[20px] font-[400] font-dmmono cursor-pointer hover:text-[#FF5500] transition-colors"
            onClick={onCancel}
          >
            cancel
          </div>
        </div>
      </div>
    </div>
  );
};
