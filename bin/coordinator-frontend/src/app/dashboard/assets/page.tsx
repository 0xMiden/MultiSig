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

  const vaultBalances = useMemo(
    () => detectedConfig?.vaultBalances ?? [],
    [detectedConfig?.vaultBalances],
  );

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
    <div className="flex flex-col p-4 w-full">
      {/* Heading */}
      <div className="mb-4">
        <div className="text-[22px] md:text-[24px] font-[600] text-[#111]">
          Assets
        </div>
        <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
          Manage your digital assets and NFTs
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6 mb-6">
        {/* Total Asset Value */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 h-[140px] md:h-[160px]">
          <div className="flex items-center gap-2">
            <div className="bg-[#FF5500]/10 rounded-[8px] w-7 h-7 flex items-center justify-center shrink-0">
              <Image src={media.totalTransactionsIcon} alt="total" quality={100} width={16} height={16} />
            </div>
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
              Total Asset Value
            </div>
          </div>
          <div className="mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] text-[#111]">
              {totalBalance.toFixed(2)}
            </div>
            <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.45)]">{vaultBalances.length} token(s)</div>
          </div>
        </div>

        {/* Number of Tokens */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 h-[140px] md:h-[160px]">
          <div className="flex items-center gap-2">
            <div className="bg-[#FF5500]/10 rounded-[8px] w-7 h-7 flex items-center justify-center shrink-0">
              <Image src={media.thisMonthIcon} alt="tokens" quality={100} width={16} height={16} />
            </div>
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
              Tokens Held
            </div>
          </div>
          <div className="mt-auto">
            <div className="text-[28px] md:text-[32px] font-[600] text-[#111]">
              {vaultBalances.length}
            </div>
            <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.45)]">Total</div>
          </div>
        </div>

        {/* Token Distribution */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 h-[140px] md:h-[160px]">
          <div className="flex items-center gap-2">
            <div className="bg-[#FF5500]/10 rounded-[8px] w-7 h-7 flex items-center justify-center shrink-0">
              <Image src={media.assetValIcon} alt="distribution" quality={100} width={16} height={16} />
            </div>
            <div className="text-[13px] font-[500] text-[rgba(0,0,0,0.5)]">
              Token Distribution
            </div>
          </div>
          <div className="mt-auto flex items-center gap-8">
            {fungibleAssetsWithPercentage.map((asset, index) => (
              <React.Fragment key={index}>
                <div className="flex flex-col gap-0.5">
                  <div className="text-[15px] font-[500] text-[#111]">Token {index + 1}</div>
                  <div className="text-[13px] font-[600] text-[#111]">{asset.percentage}%</div>
                </div>
                {index < fungibleAssetsWithPercentage.length - 1 && (
                  <div className="w-[0.5px] h-[27px] bg-[#FF5500]" />
                )}
              </React.Fragment>
            ))}
            {fungibleAssetsWithPercentage.length === 0 && (
              <div className="text-[12px] font-[400] text-[rgba(0,0,0,0.45)]">No tokens</div>
            )}
          </div>
        </div>
      </div>

      <TokenHoldings fungibleAssets={fungibleAssets} isLoading={syncingState} />
    </div>
  );
};

export default Assets;
