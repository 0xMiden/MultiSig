import React from "react";
import { ConnectWalletModalProps } from "@/types";

const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
  secretKey,
  setSecretKey,
  approverAddress,
  setApproverAddress,
  onConnect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-dmmono font-medium text-gray-900">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-4">
          <label htmlFor="secretKey" className="block text-sm font-dmmono font-medium text-gray-700 mb-2">
            Secret Key
          </label>
          <input
            type="text"
            id="secretKey"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="Enter your secret key (hex format)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF5500] focus:border-transparent font-dmmono text-sm"
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="approverAddress" className="block text-sm font-dmmono font-medium text-gray-700 mb-2">
            Approver Address
          </label>
          <input
            type="text"
            id="approverAddress"
            value={approverAddress}
            onChange={(e) => setApproverAddress(e.target.value)}
            placeholder="Enter approver address (e.g., mtst1qp27lvqjergeyypathdms4069ccv55l7)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF5500] focus:border-transparent font-dmmono text-sm"
          />
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-dmmono font-medium rounded-md hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConnect}
            disabled={!secretKey.trim() || !approverAddress.trim()}
            className="flex-1 px-4 py-2 bg-[#FF5500] hover:bg-[#E64A00] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-dmmono font-medium rounded-md transition-colors duration-200"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectWalletModal;
