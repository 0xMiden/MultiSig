"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
import { useMultisig } from "@/contexts/MultisigContext";
import { toast } from "sonner";

// Force dynamic rendering to avoid WASM loading issues during build
export const dynamic = 'force-dynamic';

const LoadExistingWallet = () => {
    const router = useRouter();
    const { setWalletId } = useAuth();
    const { handleLoad, loadingAccount, error: multisigError, activeScheme } = useMultisig();
    const [accountId, setAccountId] = useState("");
    const [accountName, setAccountName] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const handleLoadWallet = async () => {
        if (!accountId.trim() || !accountName.trim()) {
            setLocalError("Please enter both account name and account ID.");
            return;
        }

        setLocalError(null);
        try {
            await handleLoad(accountId.trim(), activeScheme);

            // Store walletFormData with just walletName
            const walletFormData = {
                walletName: accountName.trim(),
                signatureThreshold: "",
                totalSigners: "",
                network: "",
                signerAddresses: [],
                signerPublicKeys: []
            };
            localStorage.setItem("walletFormData", JSON.stringify(walletFormData));

            // Normalize account ID for storage
            let normalizedId = accountId.trim();
            if (!normalizedId.startsWith('0x')) {
                normalizedId = `0x${normalizedId}`;
            }

            setWalletId(normalizedId);
            localStorage.setItem("currentWalletId", normalizedId);
            router.push("/dashboard/home");
        } catch (error) {
            console.error("Error loading account:", error);
            const msg = error instanceof Error ? error.message : "Failed to load account";
            setLocalError(msg);
            toast.error(msg);
        }
    };

    const displayError = localError || multisigError;

    return (
        <>
            <div className="w-[90%] sm:w-[70%] flex flex-col md:space-y-14 sm:space-y-12 space-y-10 lg:space-y-16 md:w-[50%] lg:w-[40%] mx-auto h-screen py-4 md:py-6">
                {/* header starts here */}
                <div className="w-full flex flex-col space-y-1">
                    <div className="flex flex-row justify-between w-full">
                        <div className="md:text-[18px] sm:text-[16px] text-[15px] lg:text-[20px] font-[500]">
                            Load Existing Account
                        </div>
                    </div>
                </div>
                {/* header ends here */}

                <div className="w-full flex flex-col lg:space-y-6 md:space-y-5 sm:space-y-4 space-y-3">
                    <div className="w-full border border-[rgba(0,0,0,0.12)] rounded-[10px] h-auto flex flex-col p-8 lg:space-y-6 md:space-y-5 sm:space-y-4 space-y-4">
                        <div className="w-full flex flex-col gap-5">
                            <div>
                                <div className="lg:text-[22px] md:text-[20px] sm:text-[19px] text-[18px] font-[600] text-[#111]">
                                    Enter Account ID
                                </div>
                                <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] font-[400] text-[rgba(0,0,0,0.45)] mt-1">
                                    Paste the hex account ID of the multisig account you want to load
                                </div>
                            </div>

                            <div className="flex flex-col lg:space-y-2 md:space-y-1.5 space-y-1">
                                <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[12px] font-[500] text-[#111]">
                                    Account Name
                                </div>
                                <input
                                    type="text"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    placeholder="Enter account name"
                                    className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] border border-[rgba(217,217,217,1)] rounded-[6px] px-3 font-[400] text-[13px]"
                                />
                            </div>

                            <div className="flex flex-col lg:space-y-2 md:space-y-1.5 space-y-1">
                                <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[12px] font-[500] text-[#111]">
                                    Account ID
                                </div>
                                <input
                                    type="text"
                                    value={accountId}
                                    onChange={(e) => setAccountId(e.target.value)}
                                    placeholder="0x..."
                                    className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] border border-[rgba(217,217,217,1)] rounded-[6px] px-3 font-[400] text-[13px]"
                                />
                            </div>

                            {/* Error Display */}
                            {displayError && (
                                <div className="w-full border border-red-300 text-[12px] font-[400] bg-red-50 rounded-[6px] p-3 text-red-600">
                                    {displayError}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* button section starts here  */}
                    <div className="w-[90%] mx-auto lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] flex flex-row justify-between">
                        <button
                            onClick={() => router.back()}
                            className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[8px] w-[144px] h-full font-[500] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] text-[#111] hover:bg-[rgba(0,0,0,0.03)] transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleLoadWallet}
                            disabled={loadingAccount}
                            className="bg-[rgba(255,85,0,1)] px-4 min-w-[144px] rounded-[8px] h-full font-[500] lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loadingAccount ? "Loading..." : "Load Account"}
                        </button>
                    </div>
                    {/* button section ends here  */}
                </div>
            </div>
        </>
    );
};

export default LoadExistingWallet;
