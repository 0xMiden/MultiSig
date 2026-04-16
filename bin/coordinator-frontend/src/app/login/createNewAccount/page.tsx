"use client";
import Image from "next/image";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Svg from "../../../../public/svg";
import { useWalletForm } from "../../../hooks/useWalletForm";
import { useAuth } from "../../../hooks/useAuth";
import { useMultisig } from "@/contexts/MultisigContext";
import { truncateHex } from "@/lib/helpers";
import { toast } from "sonner";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const CreateNewAccount = () => {
  const router = useRouter();
  const { setWalletId } = useAuth();
  const { handleCreate, creating, activeScheme, activeCommitment, walletSource, error: multisigError } = useMultisig();
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
  // Compute the wallet source label for Signer 1
  const walletSourceLabel = walletSource === 'para'
    ? 'You (Para)'
    : walletSource === 'miden-wallet'
      ? 'You (Miden Wallet)'
      : 'You (Local)';

  // Auto-populate Signer 1 with the active wallet commitment.
  // Only dispatch when the values actually change to avoid render loops
  // (updateSigner/updateSignerPublicKeyField are not memoized).
  const prevCommitmentRef = useRef<string | null>(null);
  const prevLabelRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeCommitment && (activeCommitment !== prevCommitmentRef.current || walletSourceLabel !== prevLabelRef.current)) {
      prevCommitmentRef.current = activeCommitment;
      prevLabelRef.current = walletSourceLabel;
      updateSigner(0, walletSourceLabel);
      updateSignerPublicKeyField(0, activeCommitment);
    }
  }); // intentionally no deps — runs every render but guards with ref check

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
            // Skip signer 0 - it's auto-populated from wallet
            if (index > 0) updateSigner(index, address);
          });
        } else if (key === "signerPublicKeys") {
          (value as string[]).forEach((publicKey, index) => {
            // Skip signer 0 - it's auto-populated from wallet
            if (index > 0) updateSignerPublicKeyField(index, publicKey);
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
    // Auto-sync address from commitment (they're the same value)
    updateSigner(index, value);
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
      // Signer 1 (index 0) is "us" — handled internally by handleCreate.
      // Only pass the "other" signer commitments (index 1+).
      const otherCommitments = formData.signerPublicKeys
        .slice(1)
        .filter((k: string) => k.trim() !== '');
      const threshold = parseInt(formData.signatureThreshold, 10);

      await handleCreate(otherCommitments, threshold, undefined, activeScheme);

      toast.success("Multisig account created successfully!");
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
      <div className="w-[90%] sm:w-[70%] flex flex-col space-y-6 sm:space-y-7 md:space-y-8 lg:space-y-10 md:w-[60%] lg:w-[60%] xl:w-[45%] mx-auto h-screen py-4 md:py-6">
        {/* stepper starts here */}
        <div className="w-full flex flex-col">
          <div className="w-full">
            <div className="relative w-full">
              {/* Background track */}
              <div className="absolute top-1/2 left-[15px] right-[15px] h-[2px] bg-[rgba(0,0,0,0.08)] -translate-y-1/2 rounded-full"></div>
              {/* Progress fill */}
              <div
                className="absolute top-1/2 left-[15px] h-[2px] bg-[#FF5500] -translate-y-1/2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `calc((100% - 30px) * ${(currentStep - 1) / 3})` }}
              ></div>
              {/* Chips */}
              <div className="relative flex justify-between items-center">
                {[1, 2, 3, 4].map((step) => {
                  const isActive = step === currentStep;
                  const isCompleted = step < currentStep;
                  return (
                    <div
                      key={step}
                      className={`flex items-center justify-center rounded-full font-[500] transition-all duration-300 lg:w-[30px] lg:h-[30px] md:w-[28px] md:h-[28px] w-[26px] h-[26px] lg:text-[12px] text-[11px] shrink-0 ${
                        isActive
                          ? 'bg-[#FF5500] text-white shadow-[0_0_0_4px_rgba(255,85,0,0.12)]'
                          : isCompleted
                          ? 'bg-[#FF5500] text-white'
                          : 'bg-white border border-[rgba(0,0,0,0.12)] text-[rgba(0,0,0,0.4)]'
                      }`}
                    >
                      {step}
                    </div>
                  );
                })}
              </div>
            </div>
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
                className="w-full min-h-[500px] flex flex-col lg:space-y-8 md:space-y-7 sm:space-y-6 space-y-5"
              >
                <div className="w-full flex flex-row items-center gap-3">
                  <div className="lg:w-[56px] lg:h-[56px] md:w-[48px] md:h-[48px] sm:w-[44px] sm:h-[44px] w-[40px] h-[40px] bg-[#DFD8D3] rounded-[10px] flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lg:w-[28px] lg:h-[28px] md:w-[24px] md:h-[24px] sm:w-[22px] sm:h-[22px] w-[20px] h-[20px]">
                      <line x1="4" y1="6" x2="20" y2="6"/>
                      <circle cx="9" cy="6" r="2" fill="#DFD8D3"/>
                      <line x1="4" y1="12" x2="20" y2="12"/>
                      <circle cx="15" cy="12" r="2" fill="#DFD8D3"/>
                      <line x1="4" y1="18" x2="20" y2="18"/>
                      <circle cx="9" cy="18" r="2" fill="#DFD8D3"/>
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <div className="font-geist font-[600] text-[#111] lg:text-[20px] md:text-[19px] sm:text-[17px] text-[16px]">
                      Account Configuration
                    </div>
                    <div className="font-geist font-[400] text-[rgba(0,0,0,0.45)] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] mt-0.5">
                      Set account name and security settings
                    </div>
                  </div>
                </div>

                <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5 ">
                  <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[12px] font-[500] text-[#111]">
                    Account Name
                  </div>
                  <input
                    type="text"
                    value={formData.walletName}
                    onChange={(e) =>
                      handleInputChange("walletName", e.target.value)
                    }
                    className="bg-[rgba(245,245,245,1)] w-full lg:h-[56px] md:h-[52px] sm:h-[48px] h-[40px] rounded-[6px] px-3 font-[400] text-[13px]"
                  />
                </div>

                <div className="w-full flex flex-col md:flex-row lg:space-x-8 md:space-x-7 sm:space-y-6 space-y-5 md:space-y-0">
                  <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5">
                    <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[12px] font-[500] text-[#111]">
                      Signature Threshold
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
                      className="bg-[rgba(245,245,245,1)] w-full lg:h-[56px] md:h-[52px] sm:h-[48px] h-[40px] rounded-[6px] px-3 font-[400] text-[13px]"
                    />
                  </div>

                  <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5">
                    <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[12px] font-[500] text-[#111]">
                      Total Signers
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
                      className="bg-[rgba(245,245,245,1)] w-full lg:h-[56px] md:h-[52px] sm:h-[48px] h-[40px] rounded-[6px] px-3 font-[400] text-[13px]"
                    />
                  </div>
                </div>

                {/* Validation Error Display */}
                {thresholdError && (
                  <div className="w-full text-red-600 text-[12px] mt-2">
                    {thresholdError}
                  </div>
                )}

                <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5">
                  <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[12px] font-[500] text-[#111]">
                    Network
                  </div>
                  <input
                    type="text"
                    value={formData.network}
                    disabled
                    className="bg-[rgba(245,245,245,1)] w-full lg:h-[56px] md:h-[52px] sm:h-[48px] px-3 h-[40px] rounded-[6px] text-[rgba(0,0,0,0.48)] font-[400] text-[13px] cursor-not-allowed"
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
                className="w-full min-h-[500px] flex flex-col lg:space-y-8 md:space-y-7 sm:space-y-6 space-y-5"
              >
                <div className="w-full flex flex-row items-center gap-3">
                  <div className="lg:w-[56px] lg:h-[56px] md:w-[48px] md:h-[48px] sm:w-[44px] sm:h-[44px] w-[40px] h-[40px] bg-[#DFD8D3] rounded-[10px] flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lg:w-[28px] lg:h-[28px] md:w-[24px] md:h-[24px] sm:w-[22px] sm:h-[22px] w-[20px] h-[20px]">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <div className="font-geist font-[600] text-[#111] lg:text-[20px] md:text-[19px] sm:text-[17px] text-[16px]">
                      Add Signers
                    </div>
                    <div className="font-geist font-[400] text-[rgba(0,0,0,0.45)] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] mt-0.5">
                      Add signer commitments that will be authorized to sign transactions
                    </div>
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
                        {activeSignerIndex === 0 ? (
                          <>
                            <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[12px] font-[500] text-[#111]">
                              Signer 1 — {walletSourceLabel}
                            </div>
                            <div className="bg-[rgba(245,245,245,1)] w-full lg:min-h-[56px] md:min-h-[52px] sm:min-h-[48px] min-h-[40px] flex items-center border-[1.09px] border-[rgba(217,217,217,1)] rounded-md px-3 py-2 font-[500] text-[10px] text-[rgba(0,0,0,0.55)] break-all">
                              {activeCommitment || 'Generating keys...'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[12px] font-[500] text-[#111]">
                              Signer {activeSignerIndex + 1} Commitment
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
                                className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] rounded-md px-3 font-[500] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF5500]/60"
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
                          </>
                        )}
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
                        aria-label={i === 0 ? "Go to signer 1 (You)" : `Go to signer ${i + 1}`}
                        title={i === 0 ? "Signer 1 (You)" : `Signer ${i + 1}`}
                      >
                        <span className="font-geist font-[500] text-[8px] lg:text-[9px] md:text-[8px] sm:text-[8px]">
                          {i === 0 ? "\u2605" : i + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:space-y-6 md:space-y-4 sm:space-y-4 space-y-3 pt-2">
                  <button
                    onClick={handleAddSignerAddress}
                    disabled={!canAddSigner}
                    className="bg-[rgba(255,85,0,1)] flex items-center justify-center w-[90%] lg:h-[56px] md:h-[52px] sm:h-[48px] h-[44px] mx-auto rounded-[8px] font-[500] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {canAddSigner
                      ? "Add Another Signer"
                      : "Max Signers Reached"}
                  </button>

                  <div className="lg:text-[12px] md:text-[11px] sm:text-[10px] text-[9.5px] w-[80%] mx-auto text-center leading-relaxed">
                    Security Note: Each signer should verify their commitment is
                    correct. Incorrect commitments cannot be easily changed
                    after deployment.
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
                className="w-full min-h-[500px] flex flex-col lg:space-y-8 md:space-y-7 sm:space-y-6 space-y-5"
              >
                <div className="w-full flex flex-col">
                  <div className="w-full flex flex-row items-center gap-3">
                    <div className="lg:w-[56px] lg:h-[56px] md:w-[48px] md:h-[48px] sm:w-[44px] sm:h-[44px] w-[40px] h-[40px] bg-[#DFD8D3] rounded-[10px] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lg:w-[28px] lg:h-[28px] md:w-[24px] md:h-[24px] sm:w-[22px] sm:h-[22px] w-[20px] h-[20px]">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                        <rect x="9" y="3" width="6" height="4" rx="1"/>
                        <polyline points="9 14 11 16 15 12"/>
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <div className="font-geist font-[600] text-[#111] lg:text-[20px] md:text-[19px] sm:text-[17px] text-[16px]">
                        Review Configuration
                      </div>
                      <div className="font-geist font-[400] text-[rgba(0,0,0,0.45)] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] mt-0.5">
                        Please review your account settings before deployment
                      </div>
                    </div>
                  </div>

                  <div className="w-full flex flex-row justify-between items-center lg:h-[56px] md:h-[52px] sm:h-[48px] h-[40px] mt-4">
                    <div className="font-geist font-[500] text-[rgba(0,0,0,1)] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px]">
                      Account Name
                    </div>
                    <div className="font-geist font-[500] lg:text-[12px] md:text-[11px] sm:text-[10px] text-[9.5px] text-[rgba(0,0,0,0.55)]">
                      {formData.walletName || "Not specified"}
                    </div>
                  </div>
                  <div className="w-full h-[1px] bg-[rgba(217,217,217,1)] opacity-[40%]"></div>

                  <div className="w-full flex flex-row justify-between items-center lg:h-[56px] md:h-[52px] sm:h-[48px] h-[40px]">
                    <div className="font-geist font-[500] text-[rgba(0,0,0,1)] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px]">
                      Network
                    </div>
                    <div className="font-geist font-[500] lg:text-[12px] md:text-[11px] sm:text-[10px] text-[9.5px] text-[rgba(0,0,0,0.55)]">
                      {formData.network}
                    </div>
                  </div>
                  <div className="w-full h-[1px] bg-[rgba(217,217,217,1)] opacity-[40%]"></div>

                  <div className="w-full flex flex-row justify-between items-center lg:h-[56px] md:h-[52px] sm:h-[48px] h-[40px]">
                    <div className="font-geist font-[500] text-[rgba(0,0,0,1)] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px]">
                      Signature Policy
                    </div>
                    <div className="font-geist font-[500] lg:text-[12px] md:text-[11px] sm:text-[10px] text-[9.5px] text-[rgba(0,0,0,0.55)]">
                      {formData.signatureThreshold && formData.totalSigners
                        ? `${formData.signatureThreshold} of ${formData.totalSigners} signatures required`
                        : "Not specified"}
                    </div>
                  </div>
                  <div className="w-full h-[1px] bg-[rgba(217,217,217,1)] opacity-[40%]"></div>

                  <div className="w-full flex flex-col mt-4">
                    <div className="font-geist font-[500] text-[rgba(0,0,0,1)]  lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] mb-2">
                      Authorized Signers
                    </div>
                    <div
                      ref={step3ScrollRef}
                      onScroll={handleStep3Scroll}
                      style={{ paddingBottom: "10px" }}
                      className="w-full max-h-[110px] overflow-y-auto space-y-2 scrollbar-thin pr-1 select-none"
                    >
                      {formData.signerAddresses.map(
                        (_: string, index: number) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className="font-geist font-[500] lg:text-[12px] md:text-[11px] sm:text-[10px] text-[9.5px] text-[rgba(0,0,0,0.55)] p-3 rounded-[6px] bg-[rgba(245,245,245,1)] transition-colors"
                          >
                            <div>
                              {index === 0 ? (
                                <span>Signer 1: <strong className="text-[#111] font-[600]">{walletSourceLabel}</strong></span>
                              ) : (
                                <span>Signer {index + 1}</span>
                              )}
                            </div>
                            <div className="text-[10px] opacity-75 break-all mt-1">
                              {formData.signerPublicKeys[index] ||
                                "Not specified"}
                            </div>
                          </motion.div>
                        )
                      )}
                    </div>
                  </div>
                  <div className="w-full text-[12px] font-[400] text-[rgba(0,0,0,0.55)] mt-4">
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
                className="w-full min-h-[500px] flex flex-col lg:space-y-8 md:space-y-7 sm:space-y-6 space-y-5"
              >
                <div className="w-full flex flex-col">
                  <div className="w-full flex flex-row items-center gap-3">
                    <div className="lg:w-[56px] lg:h-[56px] md:w-[48px] md:h-[48px] sm:w-[44px] sm:h-[44px] w-[40px] h-[40px] bg-[#DFD8D3] rounded-[10px] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lg:w-[28px] lg:h-[28px] md:w-[24px] md:h-[24px] sm:w-[22px] sm:h-[22px] w-[20px] h-[20px]">
                        <path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z"/>
                        <path d="M19 14v3"/>
                        <path d="M20.5 15.5h-3"/>
                        <path d="M5 17v3"/>
                        <path d="M6.5 18.5h-3"/>
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <div className="font-geist font-[600] text-[#111] lg:text-[20px] md:text-[19px] sm:text-[17px] text-[16px]">
                        Create Account
                      </div>
                      <div className="font-geist font-[400] text-[rgba(0,0,0,0.45)] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] mt-0.5">
                        Deploy your multi-signature account to the blockchain
                      </div>
                    </div>
                  </div>
                  <div className="w-full flex flex-row items-center gap-3 bg-[rgba(46,161,80,0.07)] rounded-[10px] lg:p-5 md:p-4 sm:p-4 p-3 mt-6">
                    <div className="lg:w-[48px] lg:h-[48px] md:w-[44px] md:h-[44px] sm:w-[40px] sm:h-[40px] w-[36px] h-[36px] bg-white rounded-[10px] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="rgba(46,161,80,1)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="lg:w-[24px] lg:h-[24px] md:w-[22px] md:h-[22px] sm:w-[20px] sm:h-[20px] w-[18px] h-[18px]">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <div className="font-geist font-[600] text-[rgba(46,161,80,1)] lg:text-[16px] md:text-[15px] sm:text-[14px] text-[13px]">
                        Ready to deploy
                      </div>
                      <div className="font-geist font-[400] text-[rgba(46,161,80,0.65)] lg:text-[13px] md:text-[12px] sm:text-[11px] text-[10px] mt-0.5">
                        All configuration checks passed
                      </div>
                    </div>
                  </div>

                  <div className="w-full lg:text-[13px] text-[12px] font-[400] text-[rgba(0,0,0,0.55)] mt-4 leading-relaxed">
                    Once deployed, these settings cannot be changed. Please ensure all information is correct before proceeding.
                  </div>

                  {/* Error Display */}
                  {creationError && (
                    <div className="w-full text-[12px] font-[400] mt-4 text-red-600">
                      Error: {creationError}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* button section starts here  */}
          <div className="w-full lg:h-[56px] md:h-[52px] sm:h-[48px] h-[44px] flex flex-row gap-3">
            <button
              onClick={handlePrevious}
              className="flex-1 bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] h-full font-[500] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] text-[#111] hover:bg-[rgba(0,0,0,0.03)] transition-colors"
            >
              Previous
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
              className="flex-1 bg-[rgba(255,85,0,1)] rounded-[8px] h-full font-[500] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentStep === 4
                ? isCreating
                  ? "Creating..."
                  : "Create Account"
                : "Next"}
            </button>
          </div>
          {/* button section ends here  */}
        </div>
      </div>
    </>
  );
};

export default CreateNewAccount;
