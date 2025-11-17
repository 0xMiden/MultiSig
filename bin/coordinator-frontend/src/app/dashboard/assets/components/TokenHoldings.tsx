"use client";
import React, { useState } from "react";
import Image from "next/image";

import media from "../../../../../public/media";

import { TokenHoldingsProps } from "@/types";

const TokenHoldings = ({ fungibleAssets, isLoading }: TokenHoldingsProps) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-[0.5px] border-[#00000033] p-4 font-dmmono w-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="#00000099 font-[500] text-[#00000099] text-[16px]">
          TOKEN HOLDINGS
        </div>
      </div>

      {/*Token actions cards */}
      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-black font-dmmono text-[12px]">Loading tokens...</span>
            </div>
          </div>
        ) : fungibleAssets.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-gray-500 font-dmmono text-[12px]">No tokens available</span>
          </div>
        ) : (
          fungibleAssets.map((asset, index) => (
            <div key={index} className="bg-white border border-gray-200 py-3 px-4 flex items-center justify-between">
              {/* Left Side - Token Info */}
              <div className="flex items-center space-x-3">
                {/* Token Icon */}
                <Image
                  src={media.tokenIcon}
                  alt="tokenIcon"
                  width={24}
                  height={24}
                />

                {/* Token Details */}
                <div className="flex flex-col font-dmmono">
                  <div className="flex gap-2 items-center">
                    <div className="font-[500] text-[12px] text-black uppercase">
                      MID{index + 1}
                    </div>
                    <div className="text-[8px] text-[#0000007D] font-bold font-dmmono">Miden Token</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-xs font-mono text-black truncate max-w-[200px]">
                      {asset.faucetId}
                    </div>
                    <button
                      onClick={() => copyToClipboard(asset.faucetId, index)}
                      className="flex items-center justify-center w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded transition-colors duration-150"
                      title="Copy address"
                    >
                      {copiedIndex === index ? (
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side - Values */}
              <div className="flex flex-col items-end">
                <div className="text-[12px] font-bold text-[#000000] font-dmmono">{asset.balance/1000000}</div>
                <div className="text-[8px] text-[#000000] font-dmmono">{asset.balance/1000000} USD</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TokenHoldings;
