import React, { useState } from "react";
import media from "../../../../../public/media";
import Image from "next/image";
import { useWalletData } from "@/hooks/useWalletData";
import { Address, NetworkId, AccountInterface } from "@demox-labs/miden-sdk";

const General = () => {
  const { walletData, loading, error } = useWalletData();
  const signerIcons = [media.signer1, media.signer2, media.signer3];
  const [showTooltip, setShowTooltip] = useState(false);

  const getConvertedWalletId = () => {
    try {
      const currentWalletId = localStorage.getItem("currentWalletId");
      if (!currentWalletId) return null;
      const walletAddress = Address.fromBech32(currentWalletId);
      const walletAccountId = walletAddress.accountId();
      const convertedWalletId = walletAccountId.toBech32(
        NetworkId.Testnet,
        AccountInterface.Unspecified
      );
      return convertedWalletId;
    } catch (error) {
      console.error("Error converting wallet ID:", error);
      return localStorage.getItem("currentWalletId");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 ">
      {/* account signer list  */}
      <div className="w-full h-full border-[0.5px] border-[#00000033] flex flex-col gap-2 p-4">
        <div className="text-[16px] font-dmmono font-[500] text-[#00000099]">
          ACCOUNT SIGNERS
        </div>
        <div className="flex flex-col gap-4 ">
          {loading ? (
            // Loading spinner
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00000033] border-t-[#FF5500]"></div>
                <p className="text-[#00000099] font-dmmono text-sm font-[400]">
                  Loading signers...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-red-500 font-dmmono text-sm font-[400]">
                Error loading signers: {error}
              </p>
            </div>
          ) : walletData?.approver &&
            walletData.approver.length > 0 ? (
            walletData.approver.map((address, index) => (
              <div
                key={index}
                className="flex flex-row items-center gap-2 border-[0.5px] border-[#00000033] p-2"
              >
                <div className="w-[24px] h-[24px] border relative">
                  <Image
                    src={signerIcons[index % signerIcons.length]}
                    alt="signer"
                    fill
                    objectFit="contain"
                  />
                </div>

                <div className="flex flex-col flex-1">
                  <span className="uppercase text-[12px] font-dmmono font-[500] text-[#000000]">
                    SIGNER {index + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-dmmono font-[400] text-[#000000]">
                      {address}
                    </span>
                    <button
                      onClick={() => copyToClipboard(address)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Copy address"
                    >
                      <svg
                        className="w-3 h-3 text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-[#00000099] font-dmmono text-sm font-[400]">
                No signers found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* wallet information and network settings  */}

      <div className="w-full h-[250px] flex bg-[#FBFCFD] flex-row border-[0.5px] border-[#00000033] relative">
        <div className="flex flex-col w-1/2 h-full justify-between py-8 items-center ">
          <div className=" text-[16px] text-[#00000099] uppercase font-dmmono font-[500]">
            {" "}
            Wallet information
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[16px] font-dmmono font-[500] text-[#000000]">
              Wallet Name
            </span>
            <span className="text-[14px] font-dmmono font-[500] text-[#000000]">
              {walletData?.walletFormData?.walletName || "Unknown Wallet"}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[16px] font-dmmono font-[500] text-[#000000]">
              Address
            </span>
            <div className="relative">
              <div className="flex items-center gap-2">
                <span
                  className="text-[14px] font-dmmono font-[500] text-[#000000] cursor-help"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  {(() => {
                    const convertedWalletId = getConvertedWalletId();
                    if (convertedWalletId && convertedWalletId.length > 10) {
                      return `${convertedWalletId.slice(
                        0,
                        6
                      )}..${convertedWalletId.slice(-4)}`;
                    }
                    return convertedWalletId || "No Wallet ID";
                  })()}
                </span>

                {getConvertedWalletId() && (
                  <button
                    onClick={() => copyToClipboard(getConvertedWalletId()!)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Copy wallet address"
                  >
                    <svg
                      className="w-3 h-3 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Custom tooltip */}
              {showTooltip && getConvertedWalletId() && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs font-dmmono rounded shadow-lg whitespace-nowrap z-50">
                  {getConvertedWalletId()}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Vertical divider line */}
        <div className="absolute left-1/2 top-4 bottom-4 w-[0.5px] bg-[#00000033] transform -translate-x-1/2"></div>

        <div className="flex flex-col w-1/2 h-full gap-8 py-8 items-center ">
          <div className=" text-[16px] text-[#00000099] uppercase font-dmmono font-[500]">
            {" "}
            NETWORK SETTINGS
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[16px] font-dmmono font-[500] text-[#000000]">
              Current Network
            </span>
            <span className="text-[14px] font-dmmono font-[500] text-[#000000]">
              {walletData?.walletFormData?.network || "Unknown Network"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default General;
