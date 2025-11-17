"use client";
import { useDispatch } from "react-redux";
import { useState, useEffect, useRef } from "react";
import { AppDispatch } from "@/store";
import { setCurrentTransactionId } from "@/store/slices/transactionSlice";
import media from "../../public/media";
import Image from "next/image";
import { useMidenSdk } from "../hooks/useMidenSdk";
import { useMidenClient } from "../contexts/MidenClientContext";
import { useWalletData } from "../hooks/useWalletData";
import { Address, NoteType } from "@demox-labs/miden-sdk";
import { proposeTransactionWithTxBzThunk, fetchPendingTransactions } from "../services/transactionApi";
import { InitiateFundTransferProps } from "@/types";

const InitiateFundTransfer = ({ onCancel, fungibleAssets, isLoading: isLoadingAssets, onOpen }: InitiateFundTransferProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { Miden } = useMidenSdk();
  const { handle, isInitialized } = useMidenClient();
  const { walletData, loading: walletLoading } = useWalletData();

  // Form state
  const [formData, setFormData] = useState({
    recipientAddress: "",
    amount: "",
    currency: "",
    priority: "",
    memo: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTransactionInitiated, setIsTransactionInitiated] = useState(false);
  const [selectedFaucetId, setSelectedFaucetId] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasRefreshedRef = useRef(false);

  // Refresh assets when modal opens (only once)
  useEffect(() => {
    if (onOpen && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true;
      onOpen();
    }
  }, [onOpen]);

  useEffect(() => {
    if (fungibleAssets.length > 0 && !selectedFaucetId) {
      setSelectedFaucetId(fungibleAssets[0].faucetId);
    }
  }, [fungibleAssets, selectedFaucetId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };


  const handleCancel = () => {
    // Clear any previous transaction ID when canceling
    dispatch(setCurrentTransactionId(null));
    localStorage.removeItem("tx_id");
    onCancel?.();
  };

  const testInitiateFundTransfer = async () => {
    try {
      const currentWalletId = localStorage.getItem("currentWalletId");
      if (!currentWalletId) {
        throw new Error("No wallet ID found in localStorage");
      }

      const senderAddress = Address.fromBech32(currentWalletId);
      const senderAccountId = senderAddress.accountId();

      const targetBech32 = formData.recipientAddress;
      if (!targetBech32) {
        throw new Error("No recipient address provided");
      }

      const targetAddress = Address.fromBech32(targetBech32);
      const targetAccountId = targetAddress.accountId();

      if (!selectedFaucetId) {
        throw new Error("No faucet selected");
      }
      const faucetAddress = Address.fromBech32(selectedFaucetId);
      const faucetAccountId = faucetAddress.accountId();

      const noteType = NoteType.Public;

      const amount = BigInt(Number(formData.amount) * 1000000 || "0");

      if (!Miden) {
        throw new Error("Miden SDK not loaded");
      }

      if (!Miden || !handle || !isInitialized) {
        throw new Error("Miden client not initialized");
      }

      const webClient = handle.getWebClient();
      if (!webClient) {
        throw new Error("WebClient not available");
      }

      // Create transaction request
      const transactionRequest = webClient.newSendTransactionRequest(
        senderAccountId,
        targetAccountId,
        faucetAccountId,
        noteType,
        amount
      );

      // Serialize and convert to hex
      const serializedRequest = transactionRequest.serialize();
      const serializedRequestBase64 = serializedRequest.toBase64();

      // Propose the transaction
      const result = await dispatch(proposeTransactionWithTxBzThunk({
        accountId: currentWalletId,
        txBz: serializedRequestBase64
      })).unwrap();

      // Refresh pending transactions
      await dispatch(fetchPendingTransactions({ accountId: currentWalletId }));

      // Close the modal
      onCancel?.();

    } catch (error) {
      console.error("Error in testInitiateFundTransfer:", error);
    }
  };

  return (
    <div className="max-w-[90vw] min-w-[522px]  max-h-[90vh] bg-[#FAFAFA] shadow-2xl border border-neutral-200 opacity-100 relative">
      <div className="uppercase text-[24px] font-dmmono font-[500] text-[#000000] px-6  py-4 border-b border-neutral-200 opacity-100">
        <span className="text-[#FF5500]">SEND</span> FUNDS
      </div>
      <div className="w-full"></div>
      <div className="flex flex-col space-y-4 px-6 py-4">
        {/* Error Display */}
        {error && (
          <div className="w-full border-[1.09px] border-red-500 text-[12px] font-dmmono font-[400] bg-red-50 p-2 text-red-600">
            Error: {error}
          </div>
        )}

        <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5 ">
          <div className="uppercase lg:text-[14px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
            Recipient Address
          </div>
          <div className="relative">
            <input
              type="text"
              value={formData.recipientAddress}
              onChange={(e) =>
                handleInputChange("recipientAddress", e.target.value)
              }
              placeholder="Enter recipient address"
              className="bg-[#FFFFFF] w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 pr-10 font-dmmono font-[500] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF5500]/60"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Image
                src={media.warningIcon}
                alt="warning"
                width={16}
                height={16}
              />
            </div>
          </div>
        </div>

        <div>
          {/* amount and currency section starts here  */}
          <div className="w-full flex flex-col space-y-4">
            {/* currency section starts here  */}
            <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5 ">
              <div>
                <div className="uppercase lg:text-[14px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                  Token
                </div>
                <div className="relative" ref={dropdownRef}>
                  {/* Custom Dropdown Button */}
                  <button
                    type="button"
                    onClick={() => !isLoadingAssets && setIsDropdownOpen(!isDropdownOpen)}
                    disabled={isLoadingAssets}
                    className="bg-[#FFFFFF] w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 pr-3 font-dmmono font-[500] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF5500]/60 flex items-center justify-between cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-left">
                      {isLoadingAssets
                        ? "Loading tokens..."
                        : selectedFaucetId
                          ? `${selectedFaucetId} - ${fungibleAssets.find(asset => asset.faucetId === selectedFaucetId)?.balance / 1000000 || "0"}`
                          : ""
                      }
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-[rgba(0,0,0,0.2)] rounded-sm shadow-lg max-h-60 overflow-auto">
                      {isLoadingAssets ? (
                        <div className="px-3 py-4 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-4 h-4 border-2 border-[#FF5500] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-black font-dmmono text-[12px]">Loading tokens...</span>
                          </div>
                        </div>
                      ) : fungibleAssets.length === 0 ? (
                        <div className="px-3 py-4 text-center">
                          <span className="text-gray-500 font-dmmono text-[12px]">No tokens available</span>
                        </div>
                      ) : (
                        fungibleAssets.map((asset, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setSelectedFaucetId(asset.faucetId);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left font-dmmono text-[12px] flex items-center justify-between hover:bg-[#FF5500] hover:bg-opacity-20 transition-colors duration-150 ${selectedFaucetId === asset.faucetId ? 'bg-[#FF5500] bg-opacity-10' : ''
                              }`}
                          >
                            <span className="text-black">{asset.faucetId} - {asset.balance / 1000000}</span>
                            {selectedFaucetId === asset.faucetId && (
                              <svg className="w-4 h-4 text-[#FF5500]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-[12px] font-dmmono font-[400] text-[#00000099]">
                BALANCE: {fungibleAssets.find(asset => asset.faucetId === selectedFaucetId)?.balance / 1000000 || "0"}
              </div>
            </div>
            {/* amount section starts here  */}
            <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5 ">
              <div className="uppercase lg:text-[14px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                Amount
              </div>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => handleInputChange("amount", e.target.value)}
                placeholder="Enter amount"
                className="bg-[#FFFFFF] w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 font-dmmono font-[500] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF5500]/60"
              />
            </div>
          </div>
        </div>

        <div className="w-full flex flex-row space-x-2">
          {/* button section starts here  */}
          <div className="w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] flex flex-row gap-4">
            <button
              onClick={handleCancel}
              className="w-1/3 px-4 bg-[rgba(249,249,249,1)] border-[0.5px] border-[#00000033] uppercase h-full font-dmmono font-[400] lg:text-[14px] md:text-[14px] sm:text-[12px] text-[11px]"
            >
              cancel
            </button>
            <button
              onClick={testInitiateFundTransfer}
              disabled={
                isSubmitting || !formData.recipientAddress || !formData.amount
              }
              className="w-2/3 relative group overflow-hidden px-2 uppercase bg-[rgba(255,85,0,1)] h-full font-[500] font-dmmono lg:text-[14px] md:text-[14px] sm:text-[12px] text-[11px] text-[rgba(255,255,255,1)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute inset-0 bg-[#E64A00] transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100"></span>
              <span className="relative z-10">
                {isSubmitting ? "Processing transaction..." : "Create transfer request"}
              </span>
            </button>
          </div>
          {/* button section ends here  */}
        </div>
      </div>
      {isTransactionInitiated ? (
        <>
          <div className="w-full border-t h-[70px]  border-neutral-200 opacity-100 flex flex-col p-4 items-center justify-center">
            <div className="font-dmmono font-[500] text-[16px] text-[#28A857]">
              TRANSFER REQUEST INITIATED
            </div>
            <div className="text-[#00000099] font-dmmono font-[500] text-[14px]">
              Multi-signature transfer has been queued for approval
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="w-full border-t h-[70px] justify-center border-neutral-200 opacity-100 flex flex-col p-4">
            <div className="uppercase text-[12px] font-dmmono font-[500] text-[#000000]">
              Multi-signature required
            </div>
            <div className=" text-[10px] font-[400] font-dmmono text-[#0000007A]">
              This transfer will require {walletData?.threshold || walletData?.walletFormData?.signatureThreshold || "-"} of {walletData?.approver_number || walletData?.walletFormData?.totalSigners || "-"} approvals before execution.
            </div>
          </div>
        </>
      )}

      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 bg-[#FAFAFA] bg-opacity-[40%] backdrop-blur-md flex items-center justify-center z-50">
          <div className="text-center">
            {/* Loading Spinner */}
            <div className="w-16 h-16 border-4 border-[#FF5500] border-t-transparent rounded-full animate-spin mb-6 mx-auto"></div>

            {/* Main Text */}
            <div className="text-[16px] font-dmmono font-[500] tracking-[-4%] text-[#9b9b9b] mb-3 ">
              TRANSACTION INITIATING
            </div>

            {/* Subtitle */}
            <div className="text-[12px] italic tracking-[-2%]  font-dmmono font-[400] text-[#9b9b9b] mb-8">
              This may take a few seconds depending on server load.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InitiateFundTransfer;
