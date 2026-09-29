"use client";
import { useState, useMemo } from "react";
import media from "../../public/media";
import Image from "next/image";
import { useMultisig } from "@/contexts/MultisigContext";
import { toHexAccountId } from "@/lib/helpers";
import { toast } from "sonner";
import { useFaucetDecimals } from "@/hooks/useFaucetDecimals";
import { formatTokenAmount, parseTokenAmount } from "@/lib/tokenAmounts";

interface InitiateFundTransferProps {
  onCancel?: () => void;
}

const InitiateFundTransfer = ({ onCancel }: InitiateFundTransferProps) => {
  const {
    handleCreateP2idProposal,
    creatingProposal,
    detectedConfig,
  } = useMultisig();

  const [formData, setFormData] = useState({
    recipientId: "",
    amount: "",
    faucetId: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isTransactionInitiated, setIsTransactionInitiated] = useState(false);

  const vaultBalances = useMemo(
    () => detectedConfig?.vaultBalances ?? [],
    [detectedConfig?.vaultBalances],
  );
  const threshold = detectedConfig?.threshold ?? 0;
  const signerCount = detectedConfig?.signerCommitments?.length ?? 0;

  const token = useFaucetDecimals(formData.faucetId);
  const selectedBalance = useMemo(
    () => vaultBalances.find(v => v.faucetId === formData.faucetId)?.amount ?? 0n,
    [formData.faucetId, vaultBalances],
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleSubmit = async () => {
    setError(null);

    if (!formData.recipientId.trim()) {
      setError("Recipient account ID is required");
      return;
    }
    if (!formData.faucetId.trim()) {
      setError("Please select a token");
      return;
    }
    if (token.status !== "ready") {
      setError(token.error ?? "Loading token details, try again in a moment");
      return;
    }
    let amount: bigint;
    try {
      amount = parseTokenAmount(formData.amount, token.decimals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please enter a valid amount");
      return;
    }
    if (amount > selectedBalance) {
      setError("Amount exceeds the available balance");
      return;
    }

    try {
      const recipientHex = toHexAccountId(formData.recipientId.trim());
      await handleCreateP2idProposal(recipientHex, formData.faucetId.trim(), amount);
      setIsTransactionInitiated(true);
      toast.success("Send proposal created!");
      setTimeout(() => onCancel?.(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create send proposal");
    }
  };

  return (
    <div className="max-w-[90vw] min-w-[522px] max-h-[90vh] bg-[#FAFAFA] shadow-2xl border border-neutral-200 opacity-100 relative">
      <div className="uppercase text-[24px] font-dmmono font-[500] text-[#000000] px-6 py-4 border-b border-neutral-200 opacity-100">
        <span className="text-[#FF5500]">SEND</span> FUNDS
      </div>
      <div className="flex flex-col space-y-4 px-6 py-4">
        {error && (
          <div className="w-full border-[1.09px] border-red-500 text-[12px] font-dmmono font-[400] bg-red-50 p-2 text-red-600">
            Error: {error}
          </div>
        )}

        <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5">
          <div className="uppercase lg:text-[14px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
            Recipient Account ID
          </div>
          <div className="relative">
            <input
              type="text"
              value={formData.recipientId}
              onChange={(e) => handleInputChange("recipientId", e.target.value)}
              placeholder="0x..."
              className="bg-[#FFFFFF] w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 pr-10 font-dmmono font-[500] text-[12px] focus:outline-hidden focus:ring-2 focus:ring-[#FF5500]/60"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Image src={media.warningIcon} alt="warning" width={16} height={16} />
            </div>
          </div>
        </div>

        <div>
          <div className="w-full flex flex-col space-y-4">
            <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5">
              <div className="uppercase lg:text-[14px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                Token (Faucet ID)
              </div>
              <select
                value={formData.faucetId}
                onChange={(e) => handleInputChange("faucetId", e.target.value)}
                className="bg-[#FFFFFF] w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 font-dmmono font-[500] text-[12px] focus:outline-hidden focus:ring-2 focus:ring-[#FF5500]/60"
              >
                <option value="">Select token...</option>
                {vaultBalances.map((b, i) => (
                  <option key={i} value={b.faucetId}>
                    {b.faucetId}
                  </option>
                ))}
              </select>
              <div className="text-[12px] font-dmmono font-[400] text-[#00000099]">
                {!formData.faucetId
                  ? "BALANCE: -"
                  : token.status === "ready"
                    ? `BALANCE: ${formatTokenAmount(selectedBalance, token.decimals)}`
                    : token.status === "error"
                      ? token.error
                      : "LOADING TOKEN DETAILS…"}
              </div>
            </div>

            <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5">
              <div className="uppercase lg:text-[14px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
                Amount
              </div>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => handleInputChange("amount", e.target.value)}
                placeholder="Enter amount"
                className="bg-[#FFFFFF] w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 font-dmmono font-[500] text-[12px] focus:outline-hidden focus:ring-2 focus:ring-[#FF5500]/60"
              />
            </div>
          </div>
        </div>

        <div className="w-full flex flex-row space-x-2">
          <div className="w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] flex flex-row gap-4">
            <button
              onClick={handleCancel}
              className="w-1/3 px-4 bg-[rgba(249,249,249,1)] border-[0.5px] border-[#00000033] uppercase h-full font-dmmono font-[400] lg:text-[14px] md:text-[14px] sm:text-[12px] text-[11px]"
            >
              cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={creatingProposal || !formData.recipientId || !formData.amount || !formData.faucetId || token.status !== "ready"}
              className="w-2/3 relative group overflow-hidden px-2 uppercase bg-[rgba(255,85,0,1)] h-full font-[500] font-dmmono lg:text-[14px] md:text-[14px] sm:text-[12px] text-[11px] text-[rgba(255,255,255,1)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute inset-0 bg-[#E64A00] transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100"></span>
              <span className="relative z-10">
                {creatingProposal ? "Creating proposal..." : "Create transfer request"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {isTransactionInitiated ? (
        <div className="w-full border-t h-[70px] border-neutral-200 opacity-100 flex flex-col p-4 items-center justify-center">
          <div className="font-dmmono font-[500] text-[16px] text-[#28A857]">
            TRANSFER REQUEST INITIATED
          </div>
          <div className="text-[#00000099] font-dmmono font-[500] text-[14px]">
            Multi-signature transfer has been queued for approval
          </div>
        </div>
      ) : (
        <div className="w-full border-t h-[70px] justify-center border-neutral-200 opacity-100 flex flex-col p-4">
          <div className="uppercase text-[12px] font-dmmono font-[500] text-[#000000]">
            Multi-signature required
          </div>
          <div className="text-[10px] font-[400] font-dmmono text-[#0000007A]">
            This transfer will require {threshold || "-"} of {signerCount || "-"} approvals before execution.
          </div>
        </div>
      )}

      {creatingProposal && (
        <div className="absolute inset-0 bg-[#FAFAFA] bg-opacity-[40%] backdrop-blur-md flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#FF5500] border-t-transparent rounded-full animate-spin mb-6 mx-auto"></div>
            <div className="text-[16px] font-dmmono font-[500] tracking-[-4%] text-[#9b9b9b] mb-3">
              CREATING PROPOSAL
            </div>
            <div className="text-[12px] italic tracking-[-2%] font-dmmono font-[400] text-[#9b9b9b] mb-8">
              This may take a few seconds.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InitiateFundTransfer;
