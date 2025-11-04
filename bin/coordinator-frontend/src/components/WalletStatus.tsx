'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter';

interface WalletStatusProps {
  className?: string;
  showButton?: boolean;
}

export const WalletStatus: React.FC<WalletStatusProps> = ({ 
  className = '',
  showButton = true 
}) => {
  const { connected, connecting, publicKey } = useWallet();

  const formatPublicKey = (key: string) => {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  return (
    <motion.div
      className={`flex items-center space-x-3 ${className}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {connected ? (
        <>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-dmmono text-green-600">Connected</span>
          </div>
          {publicKey && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-md">
              <span className="text-xs font-dmmono text-gray-600">Key:</span>
              <span className="text-xs font-dmmono font-medium text-black">
                {formatPublicKey(publicKey.toString())}
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-sm font-dmmono text-red-600">Disconnected</span>
          </div>
          {connecting && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-dmmono text-[#FF5500]">Connecting...</span>
            </div>
          )}
        </>
      )}
      
      {showButton && (
        <WalletMultiButton 
          className="bg-[#FF5500] hover:bg-[#E04A00] text-white font-dmmono font-medium px-3 py-1 text-sm rounded-md transition-colors duration-200"
        />
      )}
    </motion.div>
  );
};
