"use client";
import React, { useMemo } from "react";
import { useMultisig } from "@/contexts/MultisigContext";
import { getProposalActionState } from "@/lib/proposalActions";
import { ProposalActionButton } from "@/components/ProposalActionButton";

const SignTransaction = ({
  transactionId,
  onCancel,
}: {
  transactionId: string;
  onCancel?: () => void;
}) => {
  const {
    proposals,
    detectedConfig,
    activeCommitment,
    signingProposal,
    executingProposal,
  } = useMultisig();

  const proposal = useMemo(() => {
    return proposals.find((p) => p.id === transactionId);
  }, [proposals, transactionId]);

  const action = proposal
    ? getProposalActionState(proposal, detectedConfig, activeCommitment)
    : null;
  const isSigning = signingProposal === transactionId;
  const isExecuting = executingProposal === transactionId;

  const handleCancel = () => {
    onCancel?.();
  };

  if (!proposal) {
    return (
      <div
        style={{ backgroundColor: "white" }}
        className="max-w-[90vw] h-[607px] max-h-[90vh] rounded-2xl bg-[#FAFAFA] shadow-2xl border border-neutral-200 opacity-100"
      >
        <div
          style={{ paddingTop: "20px" }}
          className="uppercase text-[24px] font-dmmono font-[500] text-[#000000] px-6 py-4"
        >
          Approve Transaction
        </div>
        <div
          style={{ height: "1px", backgroundColor: "#00000033" }}
          className="w-full"
        ></div>
        <div className="flex flex-col space-y-4 px-6 py-4">
          <div className="text-center py-8 text-[#00000099] font-dmmono">
            Proposal not found
          </div>
          <button
            onClick={handleCancel}
            className="flex-1 px-4 bg-[rgba(249,249,249,1)] border-[0.5px] border-[#00000033] uppercase h-[40px] font-dmmono font-[400] text-[14px]"
          >
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ backgroundColor: "white" }}
      className="max-w-[90vw] h-[607px] max-h-[90vh] rounded-2xl bg-[#FAFAFA] shadow-2xl border border-neutral-200 opacity-100"
    >
      <div
        style={{ paddingTop: "20px" }}
        className="uppercase text-[24px] font-dmmono font-[500] text-[#000000] px-6 py-4"
      >
        Approve Transaction
      </div>
      <div
        style={{ height: "1px", backgroundColor: "#00000033" }}
        className="w-full"
      ></div>
      <div className="flex flex-col space-y-4 px-6 py-4">
        {/* Proposal ID Display */}
        <div className="w-full border-[1.09px] border-gray-300 text-[12px] font-dmmono font-[400] bg-gray-50 p-2 text-gray-700">
          Proposal ID: {transactionId}
        </div>

        {/* Proposal Details */}
        <div className="w-full flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <span className="uppercase text-[12px] font-dmmono text-[#00000099]">
              Type
            </span>
            <span className="uppercase text-[12px] font-dmmono font-[500]">
              {proposal.metadata?.proposalType === "p2id"
                ? "SEND"
                : proposal.metadata?.proposalType === "consume_notes"
                ? "RECEIVE"
                : proposal.metadata?.proposalType.toUpperCase().replace("_", " ")}
            </span>
          </div>
          <div className="h-[0.5px] w-full bg-[#00000033]"></div>
          <div className="flex justify-between items-center">
            <span className="uppercase text-[12px] font-dmmono text-[#00000099]">
              Signatures
            </span>
            <span className="text-[12px] font-dmmono font-[500]">
              {action?.signatureCount}/{action?.requiredSignatures || "—"}
            </span>
          </div>
          <div className="h-[0.5px] w-full bg-[#00000033]"></div>
          <div className="flex justify-between items-center">
            <span className="uppercase text-[12px] font-dmmono text-[#00000099]">
              Status
            </span>
            <span
              className={`text-[12px] font-dmmono font-[500] uppercase ${
                action?.action === "execute" ? "text-[#28A857]" : "text-[#FF5500]"
              }`}
            >
              {action?.statusLabel}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] flex flex-row gap-2">
          <button
            onClick={handleCancel}
            disabled={isSigning || isExecuting}
            className="flex-1 px-4 bg-[rgba(249,249,249,1)] border-[0.5px] border-[#00000033] uppercase h-full font-dmmono font-[400] lg:text-[14px] md:text-[14px] sm:text-[12px] text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            cancel
          </button>
          <ProposalActionButton
            proposal={proposal}
            className="flex-1 h-full uppercase font-dmmono lg:text-[14px] md:text-[14px] sm:text-[12px] text-[11px]"
          />
        </div>
      </div>
    </div>
  );
};

export default SignTransaction;
