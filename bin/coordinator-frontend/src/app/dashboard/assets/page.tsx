"use client";

import React, { useState, useEffect } from "react";
import media from "../../../../public/media";
import Image from "next/image";
import TokenHoldings from "./components/TokenHoldings";

import { useFungibleAssets } from "@/hooks/useFungibleAssets";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const Assets = () => {
  const { fungibleAssets, isLoading } = useFungibleAssets();
  const [fungibleAssetsCount, setFungibleAssetsCount] = useState<number>(0);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [fungibleAssetsWithPercentage, setFungibleAssetsWithPercentage] = useState<Array<{faucetId: string, balance: string, percentage: number}>>([]);

  useEffect(() => {
    if (fungibleAssets.length > 0) {
      // Calculate total balance for percentage calculation
      const totalBalanceBigInt = fungibleAssets.reduce((sum, asset) => sum + BigInt(asset.balance), BigInt(0));
      
      // Calculate total balance in readable format (divided by 1000000)
      const totalBalanceDisplay = Number(totalBalanceBigInt) / 1000000;
      setTotalBalance(totalBalanceDisplay);
      
      // Add percentage to each asset
      const assetsWithPercentage = fungibleAssets.map(asset => {
        const balance = BigInt(asset.balance);
        const percentage = totalBalanceBigInt > 0 ? Number((balance * BigInt(100)) / totalBalanceBigInt) : 0;
        return { ...asset, percentage };
      });
      
      setFungibleAssetsWithPercentage(assetsWithPercentage);
      setFungibleAssetsCount(fungibleAssets.length);
    } else {
      setTotalBalance(0);
    }
  }, [fungibleAssets]);

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
              <div className="text-sm text-gray-700">USD</div>
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
                {fungibleAssetsCount}
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
                      {/* Asset Block */}
                      <div className="flex flex-col space-y-1">
                        <div className="text-[20px] font-[500] text-gray-800">
                          Mid {index + 1}
                        </div>
                        <div className="text-[14px] font-bold text-gray-900">
                          {asset.percentage}%
                        </div>
                      </div>
                      
                      {/* Vertical Divider (except for last item) */}
                      {index < fungibleAssetsWithPercentage.length - 1 && (
                        <div className="w-[0.5px] h-[27px] bg-[#FF5500]"></div>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Show message if no assets */}
                  {fungibleAssetsWithPercentage.length === 0 && (
                    <div className="text-gray-500 text-sm">No tokens found</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-2">
        <TokenHoldings fungibleAssets={fungibleAssets} isLoading={isLoading} />
        </div>  
       
      </div>
    </>
  );
};

export default Assets;
