import React, { useState, useEffect } from "react";
import Image from "next/image";
import media from "../../../../public/media";
import { Address, NetworkId, AccountInterface } from "@demox-labs/miden-sdk";
import ConnectWalletModal from "../../../components/ConnectWalletModal";
import { AnimatePresence, motion } from "framer-motion";
import DynamicWalletButton from "@/components/DynamicWalletButton";
import { useWalletData } from "../../../hooks/useWalletData";
import { TaskBarProps } from "@/types";

const TaskBar: React.FC<TaskBarProps> = () => {

  const { walletData, loading, error } = useWalletData();
  const [isConnectWalletOpen, setIsConnectWalletOpen] = useState(false);
  const [secretKeyHex, setSecretKeyHex] = useState("");
  const [approverAddress, setApproverAddress] = useState("");
  const [tabId, setTabId] = useState<string>("");
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const getTabId = () => {
      let currentTabId = sessionStorage.getItem("tabId");
      if (!currentTabId) {
        currentTabId = `tab_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        sessionStorage.setItem("tabId", currentTabId);
      }
      setTabId(currentTabId);
      return currentTabId;
    };

    const currentTabId = getTabId();
    loadWalletDataFromStorage(currentTabId);
  }, []);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const loadWalletDataFromStorage = (currentTabId: string) => {
    const savedApproverAddress = localStorage.getItem(
      `approver_address_${currentTabId}`
    );
    const savedSecretKey = localStorage.getItem(`secret_key_${currentTabId}`);

    if (savedApproverAddress) {
      setApproverAddress(savedApproverAddress);

    }

    if (savedSecretKey) {
      setSecretKeyHex(savedSecretKey);
    }
  };


  const getConvertedWalletId = () => {
    try {
      const currentWalletId = localStorage.getItem('currentWalletId');
      if (!currentWalletId) return null;

      const walletAddress = Address.fromBech32(currentWalletId);
      const walletAccountId = walletAddress.accountId();

      const convertedWalletId = walletAccountId.toBech32(NetworkId.Testnet, AccountInterface.BasicWallet);


      return convertedWalletId;
    } catch (error) {
      console.error('Error converting wallet ID:', error);
      return localStorage.getItem('currentWalletId'); // Fallback to original
    }
  };

  const copyWalletAddress = async () => {
    try {
      const convertedWalletId = getConvertedWalletId();
      if (convertedWalletId) {
        await navigator.clipboard.writeText(convertedWalletId);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
      }
    } catch (err) {
      console.error('Failed to copy wallet address: ', err);
    }
  };

  const handleConnectWallet = async () => {

    localStorage.setItem(`approver_address_${tabId}`, approverAddress);
    localStorage.setItem(`secret_key_${tabId}`, secretKeyHex);

    showNotification("success", "Wallet connected successfully!");

    setIsConnectWalletOpen(false);
  };

  const handleCloseConnectWalletModal = () => {
    setIsConnectWalletOpen(false);
  };


  return (
    <div className="border-b-[0.5px] border-[#0000001A] p-2 bg-white  ">
      <div className="flex items-center justify-between">
        {/* Left side - Wallet info */}
        <div className="flex items-center">
          <Image src={media.greyBox} alt="greyBox" quality={100} />
          <div className="flex flex-col px-2">
            <div className="text-[10px] md:text-[13px] text-[#000000] font-[500] font-dmmono">
              {loading ? "Loading..." : error ? "-" : walletData?.walletFormData?.walletName || "-"}
            </div>
            <div className="flex items-center gap-2">
              <div
                className="text-[7px] md:text-[10px] text-[#000000] font-[500] font-dmmono cursor-help"
                title={(() => {
                  const convertedWalletId = getConvertedWalletId();
                  return convertedWalletId || "No Wallet ID";
                })()}
              >
                {loading ? "Loading..." : error ? "Error" : (() => {
                  const convertedWalletId = getConvertedWalletId();
                  if (convertedWalletId && convertedWalletId.length > 10) {
                    return `${convertedWalletId.slice(0, 6)}..${convertedWalletId.slice(-4)}`;
                  }
                  return convertedWalletId || "No Wallet ID";
                })()}
              </div>
              <button
                onClick={copyWalletAddress}
                className="flex items-center justify-center w-4 h-4 bg-gray-100 hover:bg-gray-200 rounded transition-colors duration-150"
                title="Copy wallet address"
              >
                {isCopied ? (
                  <svg className="w-2.5 h-2.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right side - Buttons */}
        {/* <div className="flex items-center space-x-3"> */}
        {/* Sync State Button */}
        {/* <button
            onClick={handleSyncState}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-dmmono font-medium rounded-md transition-colors duration-200"
          >
            Sync State
          </button> */}

        {/* Get Consumable Notes Button */}
        {/* <button
            onClick={handleGetConsumableNotes}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm font-dmmono font-medium rounded-md transition-colors duration-200"
          >
            {isLoading ? "Fetching..." : "Get Consumable Notes"}
          </button>
        </div> */}

        <div className="pr-6">
          <DynamicWalletButton />
        </div>
      </div>

      {/* Connect Wallet Modal */}
      <ConnectWalletModal
        isOpen={isConnectWalletOpen}
        onClose={handleCloseConnectWalletModal}
        secretKey={secretKeyHex}
        setSecretKey={setSecretKeyHex}
        approverAddress={approverAddress}
        setApproverAddress={setApproverAddress}
        onConnect={handleConnectWallet}
      />

      {/* Custom Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg font-dmmono text-sm font-medium ${notification.type === "success"
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
              }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {notification.type === "success" ? "✅" : "❌"}
              </span>
              <span>{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskBar;
