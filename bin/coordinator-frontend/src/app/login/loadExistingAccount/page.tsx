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
            <div className="  w-[90%] sm:w-[70%] flex flex-col md:space-y-14 sm:space-y-12 space-y-10 lg:space-y-16 md:w-[50%] lg:w-[40%] mx-auto h-screen py-4 md:py-6">
                {/* header starts here */}
                <div className="w-full flex flex-col  space-y-1">
                    <div className="flex flex-row justify-between w-full">
                        <div className="md:text-[18px] sm:text-[16px] text-[15px] lg:text-[20px] font-[500] font-dmmono uppercase">
                            LOAD EXISTING ACCOUNT
                        </div>
                    </div>
                </div>
                {/* header ends here */}

                <div className="w-full flex flex-col lg:space-y-6 md:space-y-5 sm:space-y-4 space-y-3 ">
                    <div className="w-full border-[0.5px] border-[rgba(0,0,0,0.2)] h-auto  flex flex-col p-8 lg:space-y-8 md:space-y-7 sm:space-y-6 space-y-5">
                        <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5 ">
                            <div className="lg:text-[24px] md:text-[22px] sm:text-[20px] text-[19px] font-dmmono font-[500]">
                                ENTER ACCOUNT ID
                            </div>
                            <div className="lg:text-[14px] md:text-[13px] sm:text-[12px] text-[11px] font-dmmono font-[500]">
                                Paste the hex account ID of the multisig account you want to load
                            </div>

                            <div className="uppercase lg:text-[16px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                                ACCOUNT NAME
                            </div>
                            <input
                                type="text"
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                placeholder="Enter account name"
                                className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 font-dmmono font-[500] text-[12px]"
                            />

                            <div className="uppercase lg:text-[16px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                                ACCOUNT ID
                            </div>
                            <input
                                type="text"
                                value={accountId}
                                onChange={(e) => setAccountId(e.target.value)}
                                placeholder="0x..."
                                className="bg-[rgba(245,245,245,1)] w-full lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 font-dmmono font-[500] text-[12px]"
                            />

                            {/* Error Display */}
                            {displayError && (
                                <div className="w-full border-[1.09px] border-red-500 text-[12px] font-dmmono font-[400] mt-2 bg-red-50 p-2 text-red-600">
                                    {displayError}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* button section starts here  */}
                    <div className="w-[90%] mx-auto  lg:h-[44px] md:h-[40px] sm:h-[36px] h-[32px] flex flex-row justify-between">
                        <button
                            onClick={() => router.back()}
                            className="bg-[rgba(249,249,249,1)] border-[1.09px] border-[rgba(0,0,0,1)] w-[144px] uppercase h-full font-dmmono font-[400] lg:text-[16px] md:text-[14px] sm:text-[12px] text-[11px] "
                        >
                            BACK
                        </button>
                        <button
                            onClick={handleLoadWallet}
                            disabled={loadingAccount}
                            className="bg-[rgba(255,85,0,1)] px-4 min-w-[144px] h-full font-[500] font-dmmono lg:text-[16px] md:text-[14px] sm:text-[12px] text-[11px] text-[rgba(255,255,255,1)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loadingAccount ? "LOADING..." : "LOAD ACCOUNT"}
                        </button>
                    </div>
                    {/* button section ends here  */}
                </div>
            </div>
        </>
    );
};

export default LoadExistingWallet;
