'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@demox-labs/miden-wallet-adapter';

interface WalletInfoProps {
  className?: string;
}

export const WalletInfo: React.FC<WalletInfoProps> = ({ className = '' }) => {
  const { connected, wallet, publicKey } = useWallet();

  if (!connected || !wallet || !publicKey) {
    return null;
  }

  const formatPublicKey = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.slice(0, 6)}...${key.slice(-6)}`;
  };

  return (
    <motion.div
      className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-dmmono font-medium text-black">
            Wallet Information
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-dmmono text-green-600">Connected</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <span className="text-sm font-dmmono text-gray-600">Wallet Name:</span>
            <span className="text-sm font-dmmono font-medium text-black">
              {wallet.adapter.name}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <span className="text-sm font-dmmono text-gray-600">Public Key:</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-dmmono font-medium text-black">
                {formatPublicKey(publicKey.toString())}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(publicKey.toString())}
                className="text-[#FF5500] hover:text-[#E04A00] transition-colors"
                title="Copy to clipboard"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <span className="text-sm font-dmmono text-gray-600">Network:</span>
            <span className="text-sm font-dmmono font-medium text-black">
              Miden Testnet
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => wallet.adapter.disconnect()}
            className="w-full px-4 py-2 bg-red-500 text-white font-dmmono font-medium rounded-md hover:bg-red-600 transition-colors duration-200"
          >
            Disconnect Wallet
          </button>
        </div>
      </div>
    </motion.div>
  );
};
