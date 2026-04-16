"use client";

import React, { useMemo } from "react";
import media from "../../../../public/media";
import Image from "next/image";
import TokenHoldings from "./components/TokenHoldings";
import { useMultisig } from "@/contexts/MultisigContext";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const Assets = () => {
  const { detectedConfig, syncingState } = useMultisig();

  const vaultBalances = detectedConfig?.vaultBalances ?? [];

  const { totalBalance, fungibleAssetsWithPercentage } = useMemo(() => {
    if (vaultBalances.length === 0) {
      return { totalBalance: 0, fungibleAssetsWithPercentage: [] };
    }

    const totalBigInt = vaultBalances.reduce((sum, b) => sum + BigInt(b.amount), BigInt(0));
    const totalDisplay = Number(totalBigInt) / 1000000;

    const withPercentage = vaultBalances.map(b => {
      const balance = BigInt(b.amount);
      const percentage = totalBigInt > 0n ? Number((balance * 100n) / totalBigInt) : 0;
      return { faucetId: b.faucetId, balance: b.amount.toString(), percentage };
    });

    return { totalBalance: totalDisplay, fungibleAssetsWithPercentage: withPercentage };
  }, [vaultBalances]);

  const fungibleAssets = useMemo(() => {
    return vaultBalances.map(b => ({
      faucetId: b.faucetId,
      balance: b.amount.toString(),
    }));
  }, [vaultBalances]);

  return (
    <>
      <div className="flex flex-col p-4 w-full font-geist">
        {/*Heading*/}
        <div className="mb-4">
          <div className="text-[#111] text-[22px] md:text-[24px] font-[600] font-geist">
            Assets
          </div>
          <div className="text-[13px] md:text-[14px] text-[rgba(0,0,0,0.5)] font-geist font-[400] mt-1">
            Manage your digital assets and NFTs
          </div>
        </div>
        {/*Top Cards Div*/}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6">
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
                {vaultBalances.length} token(s)
              </div>
            </div>
          </div>
          {/*Number of Tokens Held Div*/}
          <div className="col-span-4 flex flex-col h-[140px] md:h-[160px] border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4 md:p-5 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[8px] bg-[#FF5500]/10 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px]">
                  <ellipse cx="12" cy="6" rx="8" ry="3"/>
                  <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/>
                  <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>
                </svg>
              </div>
              <div className="font-geist text-[14px] md:text-[15px] text-[#111] font-[600]">
                Tokens Held
              </div>
            </div>
            <div className="flex flex-col gap-1 mt-auto">
              <div className="text-[28px] md:text-[32px] font-[600] font-geist text-[#111] leading-none">
                {vaultBalances.length}
              </div>
              <div className="text-[11px] md:text-[12px] font-geist text-[rgba(0,0,0,0.45)]">
                Total
              </div>
            </div>
          </div>
          {/*Token Distribution Div*/}
          <div className="col-span-4 flex flex-col h-[140px] md:h-[160px] border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4 md:p-5 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[8px] bg-[#FF5500]/10 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px]">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
                  <path d="M22 12A10 10 0 0 0 12 2v10z"/>
                </svg>
              </div>
              <div className="font-geist text-[14px] md:text-[15px] text-[#111] font-[600]">
                Token Distribution
              </div>
            </div>
            <div className="flex items-center gap-4 mt-auto">
              {fungibleAssetsWithPercentage.length === 0 ? (
                <div className="text-[12px] text-[rgba(0,0,0,0.45)] font-geist">No tokens found</div>
              ) : (
                fungibleAssetsWithPercentage.map((asset, index) => (
                  <React.Fragment key={index}>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[12px] text-[rgba(0,0,0,0.55)] font-geist font-[500]">
                        Token {index + 1}
                      </div>
                      <div className="text-[18px] font-[600] text-[#111] font-geist leading-none">
                        {asset.percentage}%
                      </div>
                    </div>
                    {index < fungibleAssetsWithPercentage.length - 1 && (
                      <div className="w-px h-[28px] bg-[rgba(0,0,0,0.08)]"></div>
                    )}
                  </React.Fragment>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <TokenHoldings fungibleAssets={fungibleAssets} isLoading={syncingState} />
        </div>
      </div>
    </>
  );
};

export default Assets;
