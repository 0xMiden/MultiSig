'use client';

import React from 'react';
import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter';

const SimpleWalletButton: React.FC = () => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-dmmono font-medium text-black mb-4">
        Connect Your Wallet
      </h3>
      <p className="text-sm font-dmmono text-gray-600 mb-4">
        Click the button below to connect your Miden wallet
      </p>
      <WalletMultiButton className="bg-[#FF5500] hover:bg-[#E04A00] text-white font-dmmono font-medium px-6 py-3 rounded-md transition-colors duration-200" />
    </div>
  );
};

export default SimpleWalletButton;
