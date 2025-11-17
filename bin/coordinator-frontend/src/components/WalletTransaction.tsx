'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { useMidenSdk } from '../hooks/useMidenSdk';

interface WalletTransactionProps {
  className?: string;
}

export const WalletTransaction: React.FC<WalletTransactionProps> = ({ className = '' }) => {
  const { connected, publicKey } = useWallet();
  const { Miden, createClient, isLoading } = useMidenSdk();
  const [transactionStatus, setTransactionStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTestTransaction = async () => {
    if (!connected || !publicKey || !Miden) {
      setTransactionStatus('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    setTransactionStatus('Initializing transaction...');

    try {
      const client = await createClient();
      if (!client) {
        throw new Error('Failed to create client');
      }

      setTransactionStatus('Syncing client state...');
      await client.syncState();

      setTransactionStatus('Transaction completed successfully!');
      
      // Add a delay to show success message
      setTimeout(() => {
        setTransactionStatus('');
      }, 3000);

    } catch (error) {
      console.error('Transaction error:', error);
      setTransactionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!connected) {
    return (
      <motion.div
        className={`bg-yellow-50 border border-yellow-200 rounded-lg p-6 ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <span className="text-sm font-dmmono text-yellow-800">
            Please connect your wallet to perform transactions
          </span>
        </div>
      </motion.div>
    );
  }

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
            Wallet Transaction
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-dmmono text-green-600">Ready</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <span className="text-sm font-dmmono text-gray-600">Status:</span>
            <span className="text-sm font-dmmono font-medium text-black">
              {isLoading ? 'Loading SDK...' : 'SDK Ready'}
            </span>
          </div>

          {transactionStatus && (
            <motion.div
              className={`p-3 rounded-md ${
                transactionStatus.includes('Error') 
                  ? 'bg-red-50 border border-red-200' 
                  : transactionStatus.includes('completed') 
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-blue-50 border border-blue-200'
              }`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <span className={`text-sm font-dmmono ${
                transactionStatus.includes('Error') 
                  ? 'text-red-800' 
                  : transactionStatus.includes('completed') 
                    ? 'text-green-800'
                    : 'text-blue-800'
              }`}>
                {transactionStatus}
              </span>
            </motion.div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleTestTransaction}
            disabled={isProcessing || isLoading}
            className={`w-full px-4 py-2 font-dmmono font-medium rounded-md transition-colors duration-200 ${
              isProcessing || isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#FF5500] text-white hover:bg-[#E04A00]'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </div>
            ) : (
              'Test Transaction'
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
