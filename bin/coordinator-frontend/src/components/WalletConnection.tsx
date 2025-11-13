'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { WalletMultiButton } from '@demox-labs/miden-wallet-adapter';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { WalletConnectionProps } from '@/types';

export const WalletConnection: React.FC<WalletConnectionProps> = ({ className = '' }) => {
  const { connected, connecting, disconnecting } = useWallet();

  return (
    <motion.div
      className={`flex flex-col space-y-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-dmmono font-medium text-black">
          Wallet Connection
        </h3>
        <p className="text-sm font-dmmono text-gray-600">
          Connect your Miden wallet to manage your assets and transactions
        </p>
      </div>

      <div className="flex items-center space-x-4">
        <WalletMultiButton 
          className="bg-[#FF5500] hover:bg-[#E04A00] text-white font-dmmono font-medium px-6 py-3 rounded-md transition-colors duration-200"
        />
        
        {connected && (
          <motion.div
            className="flex items-center space-x-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-dmmono text-green-600">Connected</span>
          </motion.div>
        )}
        
        {(connecting || disconnecting) && (
          <motion.div
            className="flex items-center space-x-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="w-4 h-4 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-dmmono text-[#FF5500]">
              {connecting ? 'Connecting...' : 'Disconnecting...'}
            </span>
          </motion.div>
        )}
      </div>

      {connected && (
        <motion.div
          className="bg-green-50 border border-green-200 rounded-md p-4"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-dmmono text-green-800">
              Your wallet is connected and ready to use
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
