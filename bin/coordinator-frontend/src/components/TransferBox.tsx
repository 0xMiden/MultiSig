"use client";
import React from "react";
import { Transaction, TransferBoxProps } from "../types";
import media from "../../public/media";
import Image from "next/image";

export const TransferBox: React.FC<TransferBoxProps> = ({
  transaction,
  index,
  threshold = 3,
  onApprove,
  isSelected = false,
  onSelect,
}) => {
  // Function to convert hex string to JSON object (same as PendingActions)
  const hexToJson = (hexString: string) => {
    try {
      // Remove 0x prefix if present
      const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
      const jsonString = Buffer.from(cleanHex, 'hex').toString('utf8');
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error converting hex to JSON:', error);
      return null;
    }
  };

  // Function to calculate time ago from timestamp (same as PendingActions)
  const getTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diffInSeconds = Math.floor((now - timestamp) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };

  // Decode transaction data using the same method as PendingActions
  const decodedData = transaction.tx_summary_commit ? hexToJson(transaction.tx_summary_commit) : null;
  
  // Extract data with fallbacks (same structure as PendingActions)
  const amount = decodedData?.amount || '0.00';
  const recipient = decodedData?.recipient || 'Unknown';
  const currency = decodedData?.currency || 'MIDEN';
  const type = decodedData?.type || 'TRANSFER';
  const memo = decodedData?.memo || 'No memo';
  const timeAgo = decodedData?.timestamp ? getTimeAgo(decodedData.timestamp) : 'Unknown';
  
  // Truncate recipient address for display
  const truncatedRecipient = recipient.length > 20 
    ? `${recipient.substring(0, 10)}...${recipient.substring(recipient.length - 10)}`
    : recipient;

  return (
    <div className="flex h-[62px] w-full flex-row border-[0.5px] border-[rgba(0,0,0,0.2)] px-3">
      <div className="flex h-full w-full flex-row items-center justify-between">
        {/* left side - checkbox and content */}
        <div className="flex flex-row items-center gap-3">
          {/* Selection indicator - orange box when selected */}
          {onSelect && (
            <div 
              onClick={() => onSelect(transaction.id)}
              className={`w-4 h-4 cursor-pointer transition-all duration-200 ${
                isSelected 
                  ? 'bg-[#FF5500] scale-110' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            />
          )}
          
          {/* Transaction details */}
          <div className="flex flex-col">
            <span className="font-dmmono text-[14px] font-[500]">
              <span className="uppercase">{type}</span> {amount} {currency} to {truncatedRecipient}
            </span>
            <div className="flex flex-row">
              <div className="flex flex-row gap-2 text-[9px] font-[500] text-[#00000099] uppercase">
                <span>{transaction.signature_count}/{threshold} signed</span>
                <span>•</span>
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/*right side - status badges */}
        <div className="flex flex-row items-center space-x-3 font-dmmono">
          <div className="bg-[#FF5500] p-2 text-[9px] text-[#ffffff] uppercase">
            STANDARD
          </div>
          <div 
            className="flex flex-row items-center border-[0.5px] border-[#FF5500] p-2 text-[9px] text-[#FF5500] uppercase "
          >
            {threshold - transaction.signature_count} needed
          </div>
        </div>
      </div>
    </div>
  );
};
