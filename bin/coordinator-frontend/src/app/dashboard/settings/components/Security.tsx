import React from "react";
import DynamicWalletButton from "../../../../components/DynamicWalletButton";
import { WalletInfo } from "../../../../components/WalletInfo";
import { useWallet } from "@demox-labs/miden-wallet-adapter";

const Security = () => {
  const { connected } = useWallet();

  return (
    <div className="w-full h-full ">
      <div className="space-y-6">
        {/* Wallet Connection Section */}
        <div className="border border-gray-200 rounded-lg p-6">
          <DynamicWalletButton />
        </div>

        {/* Wallet Info Section - Only show when connected */}
        {connected && (
          <div className="border border-gray-200 rounded-lg p-6">
            <WalletInfo />
          </div>
        )}
      </div>
    </div>
  );
};

export default Security;
