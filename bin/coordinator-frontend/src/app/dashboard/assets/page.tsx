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
      <div className="flex flex-col p-2 w-[calc(100vw-150px)] font-dmmono">
        {/*Heading*/}
        <div className="p-2">
          <div className="text-[#000000] text-[24px] font-bold font-dmmono">
            ASSETS
          </div>
          <div className="text-[16px] text-[#0000007A] font-dmmono font-bold">
            Manage your digital assets and NFTS
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
                TOTAL ASSET VALUE
              </div>
            </div>
            <div>
              <div className=" text-[24px] font-[500] font-dmmono text-[#000000]">
                {totalBalance.toFixed(2)}
              </div>
              <div className="text-sm text-gray-700">{vaultBalances.length} token(s)</div>
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
                NUMBER OF TOKENS HELD
              </div>
            </div>
            <div>
              <div className=" text-[24px] font-[500] font-dmmono text-[#000000]">
                {vaultBalances.length}
              </div>
              <div className="text-sm text-gray-700">Total</div>
            </div>
          </div>
          {/*Success Rate Div*/}
          <div className="col-span-4 flex flex-col justify-between h-[135px] border-[0.5px] border-[#00000033] p-3">
            <div className="flex items-left space-x-2 font-dmmono text-black">
              <Image
                src={media.assetValIcon}
                alt="assetValIcon"
                quality={100}
              />
              <div className="font-dmmono text-[16px] text-[#000000] font-[500]">
                Token Distribution
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-700">
                <div className="flex items-center space-x-8">
                  {fungibleAssetsWithPercentage.map((asset, index) => (
                    <React.Fragment key={index}>
                      <div className="flex flex-col space-y-1">
                        <div className="text-[20px] font-[500] text-gray-800">
                          Token {index + 1}
                        </div>
                        <div className="text-[14px] font-bold text-gray-900">
                          {asset.percentage}%
                        </div>
                      </div>
                      {index < fungibleAssetsWithPercentage.length - 1 && (
                        <div className="w-[0.5px] h-[27px] bg-[#FF5500]"></div>
                      )}
                    </React.Fragment>
                  ))}
                  {fungibleAssetsWithPercentage.length === 0 && (
                    <div className="text-gray-500 text-sm">No tokens found</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-2">
          <TokenHoldings fungibleAssets={fungibleAssets} isLoading={syncingState} />
        </div>
      </div>
    </>
  );
};

export default Assets;
