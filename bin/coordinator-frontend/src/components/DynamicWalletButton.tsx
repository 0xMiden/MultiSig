'use client';

import React, { useState, useEffect } from 'react';
import { WalletAdapterNetwork } from '@demox-labs/miden-wallet-adapter-base';

const DynamicWalletButton: React.FC = () => {
  const [WalletMultiButton, setWalletMultiButton] = useState<React.ComponentType<{ className?: string; network?: WalletAdapterNetwork }> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadWalletAdapter = async () => {
      try {
        const { WalletMultiButton } = await import('@demox-labs/miden-wallet-adapter');
        setWalletMultiButton(() => WalletMultiButton);
      } catch (error) {
        console.error('Failed to load wallet adapter:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWalletAdapter();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded-md"></div>
        </div>
      </div>
    );
  }

  if (!WalletMultiButton) {
    return (
      <div className="p-4">
        <div className="text-red-500">Failed to load wallet adapter</div>
      </div>
    );
  }

  return (
    <WalletMultiButton network={WalletAdapterNetwork.Testnet} className="h-[34px] bg-[#FF5500] hover:bg-[#E04A00] text-white font-dmmono font-[500] text-[12px] text-center py-2 transition-colors duration-200 cursor-pointer" />
  );
};

export default DynamicWalletButton;
