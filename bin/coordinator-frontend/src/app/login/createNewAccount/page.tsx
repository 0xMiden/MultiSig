"use client";
import Image from "next/image";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Svg from "../../../../public/svg";
import { useWalletForm } from "../../../hooks/useWalletForm";
import { createMultiSigWallet } from "../../../services/walletApi";
import { useAuth } from "../../../hooks/useAuth";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const CreateNewAccount = () => {
  const router = useRouter();
  const { setWalletId } = useAuth();
  const {
    formData,
    currentStep,
    updateField,
    updateSigner,
    updateSignerPublicKeyField,
    addSigner,
    removeSigner,
    goToStep,
  } = useWalletForm();

  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  const [animationDirection, setAnimationDirection] = useState<
    "forward" | "backward"
  >("forward");
  const [editingFields, setEditingFields] = useState({
    signatureThreshold: false,
    totalSigners: false,
  });
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current) return;
    const savedData = localStorage.getItem("walletFormData");
    const savedStep = localStorage.getItem("walletCurrentStep");

    if (savedData) {
      const parsedData = JSON.parse(savedData);
      Object.entries(parsedData).forEach(([key, value]) => {
        if (key === "signerAddresses") {
          (value as string[]).forEach((address, index) => {
            updateSigner(index, address);
          });
        } else if (key === "signerPublicKeys") {
          (value as string[]).forEach((publicKey, index) => {
            updateSignerPublicKeyField(index, publicKey);
          });
        } else {
          updateField(key, value as string);
        }
      });
    }
    if (savedStep) {
      goToStep(parseInt(savedStep));
    }
    hasRestoredRef.current = true;
  }, [goToStep, updateField, updateSigner, updateSignerPublicKeyField]);
  useEffect(() => {
    localStorage.setItem("walletFormData", JSON.stringify(formData));
    localStorage.setItem("walletCurrentStep", currentStep.toString());
  }, [formData, currentStep]);

  // Validate that signature threshold doesn't exceed total signers
  useEffect(() => {
    const threshold = parseInt(formData.signatureThreshold, 10);
    const totalSigners = parseInt(formData.totalSigners, 10);

    if (formData.signatureThreshold && formData.totalSigners) {
      if (threshold > totalSigners) {
        setThresholdError("Signature threshold cannot exceed total number of signers");
      } else if (threshold === 0) {
        setThresholdError("Signature threshold must be at least 1");
      } else {
        setThresholdError(null);
      }
    } else {
      setThresholdError(null);
    }
  }, [formData.signatureThreshold, formData.totalSigners]);
  const handleInputChange = (field: string, value: string) => {
    updateField(field, value);
  };
  const handleSignatureThresholdChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value.replace(/\D/g, "");
    updateField("signatureThreshold", value);
  };
  const handleTotalSignersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    updateField("totalSigners", value);
  };

  const handleSignerAddressChange = (index: number, value: string) => {
    updateSigner(index, value);
  };

  const handleSignerPublicKeyChange = (index: number, value: string) => {
    updateSignerPublicKeyField(index, value);
  };

  const handleAddSignerAddress = () => {
    const maxSigners = parseInt(formData.totalSigners, 10);
    if (!Number.isInteger(maxSigners) || maxSigners <= 0) return;
    if (formData.signerAddresses.length >= maxSigners) return;
    addSigner();
    try {
      setActiveSignerIndex(formData.signerAddresses.length);
    } catch { }
  };

  const handleRemoveSignerAddress = (index: number) => {
    removeSigner(index);
  };

  const [activeSignerIndex, setActiveSignerIndex] = useState(0);
  const [step3ScrollTop, setStep3ScrollTop] = useState(0);
  const step3ScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeSignerIndex > formData.signerAddresses.length - 1) {
      setActiveSignerIndex(Math.max(0, formData.signerAddresses.length - 1));
    }
  }, [formData.signerAddresses.length, activeSignerIndex]);
  useEffect(() => {
    if (currentStep === 2) {
      setActiveSignerIndex(0);
    }
  }, [currentStep]);

  const handleJumpToSigner = (index: number) => {
    setActiveSignerIndex(index);
  };
  const handleStep3Scroll = (e: React.UIEvent<HTMLDivElement>) => {
    setStep3ScrollTop(e.currentTarget.scrollTop);
  };
  const handleCreateWallet = async () => {
    setIsCreating(true);
    setCreationError(null);

    try {
      const result = await createMultiSigWallet(formData);
      setWalletId(result.address);
      router.push("/dashboard/home");
    } catch (error) {
      console.error("Failed to create wallet:", error);
      setCreationError(
        error instanceof Error ? error.message : "Failed to create wallet"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep === 1) {
      router.back();
    } else {
      setAnimationDirection("backward");
      goToStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep === 4) {
      handleCreateWallet();
    } else if (currentStep < 4) {
      setAnimationDirection("forward");
      goToStep(currentStep + 1);
    }
  };

  const totalSignersNum = parseInt(formData.totalSigners, 10);
  const filledSignersCount = formData.signerAddresses.filter(
    (addr: string) => addr.trim() !== ""
  ).length;
  const filledPublicKeysCount = formData.signerPublicKeys.filter(
    (key: string) => key.trim() !== ""
  ).length;
  const canAddSigner =
    Number.isInteger(totalSignersNum) &&
    totalSignersNum > 0 &&
    formData.signerAddresses.length < totalSignersNum;

  return (
    <>
      <div className="  w-[90%] sm:w-[70%] flex flex-col md:space-y-14 sm:space-y-12 space-y-10 lg:space-y-16 md:w-[60%] lg:w-[60%] xl:w-[45%] mx-auto h-screen py-4 md:py-6">
        {/* stepper starts here */}
        <div className="w-full flex flex-col  space-y-1">
          <div className="flex flex-row justify-between w-full">
            <div className="md:text-[18px] sm:text-[16px] text-[15px] lg:text-[20px] font-[500] font-dmmono uppercase">
              CREATE NEW ACCOUNT
            </div>

            <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] font-dmmono font-[500]">
              STEP {currentStep} OF 4
            </div>
          </div>
          <div className="lg:h-[8px] md:h-[7px] sm:h-[6px] h-[5px] w-full bg-[#D9D9D9] relative">
            <div
              className="lg:h-[8px] md:h-[7px] sm:h-[6px] h-[5px] bg-[#FF5500] absolute top-0 left-0 transition-all duration-300 ease-in-out"
              style={{ width: `${currentStep * 25}%` }}
            ></div>
          </div>
        </div>
        {/* stepper ends here */}

        <div className="w-full flex flex-col lg:space-y-6 md:space-y-5 sm:space-y-4 space-y-3 ">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{
                  opacity: 0,
                  x: animationDirection === "forward" ? 100 : -100,
                }}
                animate={{ opacity: 1, x: 0 }}
                exit={{
                  opacity: 0,
                  x: animationDirection === "forward" ? -100 : 100,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full border-[0.5px] border-[rgba(0,0,0,0.2)] min-h-[500px]  flex flex-col p-8 lg:space-y-8  md:space-y-7 sm:space-y-6 space-y-5"
              >
                <div className="w-full  flex flex-col items-center">
                  <div className="lg:w-[48px] lg:h-[48px] md:w-[40px] md:h-[40px] sm:w-[36px] sm:h-[36px] w-[32px] h-[32px] bg-[#F9F9F9] border-[0.5px] border-[rgba(0,0,0,0.2)] relative ">
                    <Image fill objectFit="contain" src={Svg.logo} alt="logo" />
                  </div>
                  <div className="uppercase font-dmmono font-[500] text-[#FF5500] lg:text-[24px] md:text-[22px] sm:text-[20px] text-[19px] ">
                    ACCOUNT CONFIGURATION
                  </div>
                  <div className="font-dmmono font-[400] text-[#000000] opacity-[40%] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px]">
                    Set account name and security settings
                  </div>
                </div>

                <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5 ">
                  <div className="uppercase lg:text-[16px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                    ACCOUNT NAME
                  </div>
                  <input
                    type="text"
                    value={formData.walletName}
                    onChange={(e) =>
                      handleInputChange("walletName", e.target.value)
                    }
                    className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 font-dmmono font-[500] text-[12px]"
                  />
                </div>

                <div className="w-full flex flex-col md:flex-row lg:space-x-8 md:space-x-7 sm:space-y-6 space-y-5 md:space-y-0">
                  <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5">
                    <div className="uppercase lg:text-[16px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                      SIGNATURE THRESHOLD
                    </div>
                    <input
                      type="text"
                      value={
                        editingFields.signatureThreshold
                          ? formData.signatureThreshold
                          : formData.signatureThreshold
                            ? `${formData.signatureThreshold} signatures required`
                            : ""
                      }
                      onChange={handleSignatureThresholdChange}
                      onFocus={() =>
                        setEditingFields((prev) => ({
                          ...prev,
                          signatureThreshold: true,
                        }))
                      }
                      onBlur={() =>
                        setEditingFields((prev) => ({
                          ...prev,
                          signatureThreshold: false,
                        }))
                      }
                      placeholder="Enter number of signatures required"
                      className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 font-dmmono font-[500] text-[12px]"
                    />
                  </div>

                  <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5">
                    <div className="uppercase lg:text-[16px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                      TOTAL SIGNERS
                    </div>
                    <input
                      type="text"
                      value={
                        editingFields.totalSigners
                          ? formData.totalSigners
                          : formData.totalSigners
                            ? `${formData.totalSigners} signers`
                            : ""
                      }
                      onChange={handleTotalSignersChange}
                      onFocus={() =>
                        setEditingFields((prev) => ({
                          ...prev,
                          totalSigners: true,
                        }))
                      }
                      onBlur={() =>
                        setEditingFields((prev) => ({
                          ...prev,
                          totalSigners: false,
                        }))
                      }
                      placeholder="Enter number of signers"
                      className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 font-dmmono font-[500] text-[12px]"
                    />
                  </div>
                </div>

                {/* Validation Error Display */}
                {thresholdError && (
                  <div className="w-full text-red-600 font-dmmono text-[12px] mt-2">
                    {thresholdError}
                  </div>
                )}

                <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5">
                  <div className="uppercase lg:text-[16px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                    NETWORK
                  </div>
                  <input
                    type="text"
                    value={formData.network}
                    disabled
                    className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] px-3 h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] text-[rgba(0,0,0,0.48)] font-dmmono font-[500] text-[12px] cursor-not-allowed"
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{
                  opacity: 0,
                  x: animationDirection === "forward" ? 100 : -100,
                }}
                animate={{ opacity: 1, x: 0 }}
                exit={{
                  opacity: 0,
                  x: animationDirection === "forward" ? -100 : 100,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full border-[0.5px] border-[rgba(0,0,0,0.2)] h-[500px] flex flex-col p-6"
              >
                <div className="w-full flex flex-col items-center lg:space-y-2  sm:space-y-4 space-y-3">
                  <div className="lg:w-[48px] lg:h-[48px] md:w-[40px] md:h-[40px] sm:w-[36px] sm:h-[36px] w-[32px] h-[32px] bg-[#F9F9F9] border-[0.5px] border-[rgba(0,0,0,0.2)] relative">
                    <Image fill objectFit="contain" src={Svg.logo} alt="logo" />
                  </div>
                  <div className="uppercase font-dmmono font-[500] text-[#rgba(0,0,0,1)] lg:text-[24px] md:text-[22px] sm:text-[20px] text-[19px] ">
                    ADD SIGNERS
                  </div>
                  <div className="font-dmmono font-[400] text-[#000000]  lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] ">
                    Add account addresses that will be authorized to sign
                    transactions
                  </div>
                </div>

                <div className="flex-1 flex flex-col  mt-4">
                  {/* Carousel Content */}
                  <div className="flex-1 pr-1 select-none pl-1">
                    <AnimatePresence mode="popLayout">
                      <motion.div
                        key={activeSignerIndex}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -24 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="w-full flex flex-col lg:space-y-1 md:space-y-1.5 sm:space-y-1 space-y-1"
                      >
                        <div className="uppercase lg:text-[16px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                          Signer {activeSignerIndex + 1} Address
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={formData.signerAddresses[activeSignerIndex]}
                            onChange={(e) =>
                              handleSignerAddressChange(
                                activeSignerIndex,
                                e.target.value
                              )
                            }
                            className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] rounded-md px-3 font-dmmono font-[500] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF5500]/60"
                          />
                          {formData.signerAddresses.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveSignerAddress(activeSignerIndex)
                              }
                              aria-label="Remove signer"
                              title="Remove signer"
                              className="shrink-0 w-9 h-9 lg:w-11 lg:h-11 md:w-10 md:h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-md border border-[rgba(217,217,217,1)] text-[rgba(0,0,0,0.6)] hover:text-[#FF5500] hover:border-[#FF5500] hover:bg-[#FF5500]/10 transition"
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M4 4L12 12M12 4L4 12"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          )}
                        </div>

                        <div className="uppercase lg:text-[16px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                          Signer {activeSignerIndex + 1} Public Key
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={
                              formData.signerPublicKeys[activeSignerIndex] || ""
                            }
                            onChange={(e) =>
                              handleSignerPublicKeyChange(
                                activeSignerIndex,
                                e.target.value
                              )
                            }
                            placeholder="0x..."
                            className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] rounded-md px-3 font-dmmono font-[500] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF5500]/60"
                          />
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Clickable Dots Navigation */}
                  <div className="flex items-center justify-center gap-2 pt-4">
                    {formData.signerAddresses.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleJumpToSigner(i)}
                        className={`w-5 h-5 lg:w-6 lg:h-6 md:w-5.5 md:h-5.5 sm:w-5 sm:h-5 flex items-center justify-center rounded-md border-2 transition-all duration-200 hover:scale-110 ${i === activeSignerIndex
                          ? "bg-[#FF5500] border-[#FF5500] text-white"
                          : "bg-white border-[rgba(217,217,217,1)] text-[rgba(0,0,0,0.6)] hover:border-[#FF5500] hover:text-[#FF5500]"
                          }`}
                        aria-label={`Go to signer ${i + 1}`}
                        title={`Go to signer ${i + 1}`}
                      >
                        <span className="font-dmmono font-[500] text-[8px] lg:text-[9px] md:text-[8px] sm:text-[8px]">
                          {i + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:space-y-6 md:space-y-4 sm:space-y-4 space-y-3 pt-2">
                  <button
                    onClick={handleAddSignerAddress}
                    disabled={!canAddSigner}
                    className="bg-[rgba(255,85,0,1)] flex items-center justify-center w-[90%] lg:h-[56px] md:h-[52px] sm:h-[48px] h-[44px] mx-auto font-dmmono font-[500] lg:text-[16px] md:text-[14px] sm:text-[12px] text-[11px] text-[rgba(255,255,255,1)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {canAddSigner
                      ? "ADD ANOTHER SIGNER"
                      : "MAX SIGNERS REACHED"}
                  </button>

                  <div className="lg:text-[12px] md:text-[11px] sm:text-[10px] text-[9.5px] w-[80%] mx-auto font-dmmono text-center leading-relaxed">
                    Security Note: Each signer should verify their address and
                    public key are correct. Incorrect addresses or public keys
                    cannot be easily changed after deployment.
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{
                  opacity: 0,
                  x: animationDirection === "forward" ? 100 : -100,
                }}
                animate={{ opacity: 1, x: 0 }}
                exit={{
                  opacity: 0,
                  x: animationDirection === "forward" ? -100 : 100,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full border-[0.5px] border-[rgba(0,0,0,0.2)] min-h-[500px] flex flex-col p-8 lg:space-y-8 md:space-y-7 sm:space-y-6 space-y-5"
              >
                <div className="w-full flex flex-col items-center">
                  <div className="lg:w-[48px] lg:h-[48px] md:w-[40px] md:h-[40px] sm:w-[36px] sm:h-[36px] w-[32px] h-[32px] bg-[#F9F9F9] border-[0.5px] border-[rgba(0,0,0,0.2)] relative">
                    <Image fill objectFit="contain" src={Svg.logo} alt="logo" />
                  </div>
                  <div className="uppercase font-dmmono font-[500] text-[rgba(0,0,0,1)] lg:text-[24px] md:text-[22px] sm:text-[20px] text-[19px] ">
                    REVIEW CONFIGURATION
                  </div>
                  <div className="font-dmmono font-[400] text-[#000000]  lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px]">
                    Please review your account settings before deployment
                  </div>

                  <div className="w-full flex flex-row justify-between mt-4">
                    <div className="font-dmmono font-[500] text-[rgba(0,0,0,1)]  lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px]">
                      Account Name
                    </div>
                    <div className="font-dmmono font-[500] lg:text-[12px] md:text-[11px] sm:text-[10px] text-[9.5px] text-[rgba(0,0,0,0.55)] ">
                      {formData.walletName || "Not specified"}
                    </div>
                  </div>
                  <div className="w-full h-[1px] bg-[rgba(217,217,217,1)] opacity-[40%]"></div>

                  <div className="w-full flex flex-row justify-between mt-4">
                    <div className="font-dmmono font-[500] text-[rgba(0,0,0,1)]  lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px]">
                      Network
                    </div>
                    <div className="font-dmmono font-[500] lg:text-[12px] md:text-[11px] sm:text-[10px] text-[9.5px] text-[rgba(0,0,0,0.55)] ">
                      {formData.network}
                    </div>
                  </div>
                  <div className="w-full h-[1px] bg-[rgba(217,217,217,1)] opacity-[40%]"></div>

                  <div className="w-full flex flex-row justify-between mt-4">
                    <div className="font-dmmono font-[500] text-[rgba(0,0,0,1)]  lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px]">
                      Signature Policy
                    </div>
                    <div className="font-dmmono font-[500] lg:text-[12px] md:text-[11px] sm:text-[10px] text-[9.5px] text-[rgba(0,0,0,0.55)] ">
                      {formData.signatureThreshold && formData.totalSigners
                        ? `${formData.signatureThreshold} of ${formData.totalSigners} signatures required`
                        : "Not specified"}
                    </div>
                  </div>
                  <div className="w-full h-[1px] bg-[rgba(217,217,217,1)] opacity-[40%]"></div>

                  <div className="w-full flex flex-col mt-4">
                    <div className="font-dmmono font-[500] text-[rgba(0,0,0,1)]  lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] mb-2">
                      Authorized Signers
                    </div>
                    <div
                      ref={step3ScrollRef}
                      onScroll={handleStep3Scroll}
                      style={{ paddingBottom: "10px" }}
                      className="w-full max-h-[110px] overflow-y-auto space-y-2 scrollbar-thin pr-1 select-none"
                    >
                      {formData.signerAddresses.map(
                        (address: string, index: number) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className="font-dmmono font-[500] lg:text-[12px] md:text-[11px] sm:text-[10px] text-[9.5px] text-[rgba(0,0,0,0.55)] bg-[rgba(245,245,245,1)] p-2 rounded hover:bg-[rgba(235,235,235,1)] transition-colors"
                          >
                            <div>
                              Signer {index + 1}: {address || "Not specified"}
                            </div>
                            <div className="text-[10px] opacity-75">
                              Public Key:{" "}
                              {formData.signerPublicKeys[index] ||
                                "Not specified"}
                            </div>
                          </motion.div>
                        )
                      )}
                    </div>
                  </div>
                  <div className="w-full border-[1.09px] border-[rgba(217,217,217,1)] text-[12px] font-dmmono font-[400] bg-[rgba(245,245,245,1)] p-2 ">
                    Important: Once deployed, these settings cannot be changed.
                    Please ensure all information is correct before proceeding.
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{
                  opacity: 0,
                  x: animationDirection === "forward" ? 100 : -100,
                }}
                animate={{ opacity: 1, x: 0 }}
                exit={{
                  opacity: 0,
                  x: animationDirection === "forward" ? -100 : 100,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full border-[0.5px] border-[rgba(0,0,0,0.2)] min-h-[500px] flex flex-col p-8 lg:space-y-8 md:space-y-7 sm:space-y-6 space-y-5"
              >
                <div className="w-full flex flex-col items-center ">
                  <div className="lg:w-[48px] lg:h-[48px] md:w-[40px] md:h-[40px] sm:w-[36px] sm:h-[36px] w-[32px] h-[32px] bg-[#F9F9F9] border-[0.5px] border-[rgba(0,0,0,0.2)] relative">
                    <Image fill objectFit="contain" src={Svg.logo} alt="logo" />
                  </div>
                  <div className="uppercase font-dmmono font-[500] text-[rgba(0,0,0,1)] lg:text-[24px] md:text-[22px] sm:text-[20px] text-[19px] ">
                    CREATE ACCOUNT
                  </div>
                  <div className="font-dmmono font-[400] text-[#000000]  lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px]">
                    Deploy your multi-signature account to the blockchain
                  </div>
                  <div className="w-full h-[123px] border-[0.5px] border-[rgba(46,161,80,1)] flex flex-col items-center justify-center bg-[rgba(238,253,243,1)] my-10">
                    <div className="relative w-[48px] h-[48px] my-2">
                      <Image
                        src={Svg.tick}
                        alt="tick"
                        fill
                        objectFit="contain"
                      />
                    </div>
                    <div className="font-dmmono font-[500] text-[rgba(46,161,80,1)] lg:text-[16px] md:text-[14px] sm:text-[12px] text-[11px]">
                      Ready to Deploy
                    </div>
                  </div>

                  <div className="w-full border-[1.09px] border-[rgba(217,217,217,1)] text-[12px] font-dmmono font-[400] mt-14  bg-[rgba(245,245,245,1)] p-2  ]">
                    Important: Once deployed, these settings cannot be changed.
                    Please ensure all information is correct before proceeding.
                  </div>

                  {/* Error Display */}
                  {creationError && (
                    <div className="w-full border-[1.09px] border-red-500 text-[12px] font-dmmono font-[400] mt-4 bg-red-50 p-2 text-red-600">
                      Error: {creationError}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* button section starts here  */}
          <div className="w-[90%] mx-auto  lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] flex flex-row justify-between">
            <button
              onClick={handlePrevious}
              className="bg-[rgba(249,249,249,1)] border-[1.09px] border-[rgba(0,0,0,1)] w-[144px] uppercase h-full font-dmmono font-[400] lg:text-[16px] md:text-[14px] sm:text-[12px] text-[11px] "
            >
              PREVIOUS
            </button>
            <button
              onClick={handleNext}
              disabled={
                isCreating ||
                (currentStep === 1 &&
                  (!formData.walletName ||
                    !formData.signatureThreshold ||
                    !formData.totalSigners ||
                    thresholdError !== null)) ||
                (currentStep === 2 &&
                  (Number.isNaN(totalSignersNum) ||
                    filledSignersCount < totalSignersNum ||
                    filledPublicKeysCount < totalSignersNum))
              }
              className="bg-[rgba(255,85,0,1)] px-4 min-w-[144px] h-full font-[500] font-dmmono lg:text-[16px] md:text-[14px] sm:text-[12px] text-[11px] text-[rgba(255,255,255,1)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentStep === 4
                ? isCreating
                  ? "CREATING..."
                  : "CREATE ACCOUNT"
                : "NEXT"}
            </button>
          </div>
          {/* button section ends here  */}
        </div>
      </div>
    </>
  );
};

export default CreateNewAccount;
