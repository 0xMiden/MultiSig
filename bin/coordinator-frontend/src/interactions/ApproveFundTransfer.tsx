"use client";
import React, { useMemo, useState } from "react";
import { useMultisig } from "@/contexts/MultisigContext";
import { toast } from "sonner";
import { getEffectiveThreshold } from "@/lib/procedures";

export const ApproveFundTransfer = ({
  onCancel,
}: {
  onCancel?: () => void;
}) => {
  const {
    proposals,
    detectedConfig,
    handleSignProposal,
    handleExecuteProposal,
    signingProposal,
    executingProposal,
    syncingState,
  } = useMultisig();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const pendingProposals = useMemo(() => {
    return proposals.filter(p => p.status.type === 'pending' || p.status.type === 'ready');
  }, [proposals]);

  const threshold = detectedConfig?.threshold ?? 0;

  const handleSelectAll = () => {
    if (selectedIds.length === pendingProposals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingProposals.map(p => p.id));
    }
  };

  const handleToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const handleSignSelected = async () => {
    for (const id of selectedIds) {
      try {
        await handleSignProposal(id);
      } catch (err) {
        toast.error(`Failed to sign ${id.slice(0, 8)}...`);
      }
    }
    setSelectedIds([]);
    toast.success("Signed selected proposals");
  };

  if (syncingState) {
    return (
      <div className="max-w-[90vw] max-h-[90vh] bg-[#FAFAFA] shadow-2xl border border-neutral-200 opacity-100">
        <div className="max-w-4xl mx-auto">
          <div className="w-[80vh] space-y-4 border-[0.5px] border-[rgba(0,0,0,0.2)] p-[30px]">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5500] mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading proposals...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[90vw] max-h-[90vh] bg-[#FAFAFA] shadow-2xl border border-neutral-200 opacity-100">
      <div className="max-w-4xl mx-auto">
        <div className="w-[80vh] space-y-4 border-[0.5px] border-[rgba(0,0,0,0.2)] p-4">
          <div className="font-dbmono text-[20px] font-[500] text-[#000000]">
            APPROVE QUEUED TRANSFERS
          </div>

          <div className="border-[0.25px] h-0 w-full bg-[#00000033]"></div>

          <div className="flex flex-row items-center justify-between">
            <span className="font-dmmono text-[14px] font-[500] text-[rgba(0,0,0,1)] uppercase">
              pending your signature ({pendingProposals.length})
            </span>

            <button
              onClick={handleSelectAll}
              className="bg-[#28A857] hover:bg-[#28A857]/80 text-[7.59px] text-white font-dmmono font-[500] px-2 py-1 transition-colors uppercase"
            >
              SELECT All ({pendingProposals.length})
            </button>
          </div>

          {pendingProposals.length === 0 ? (
            <div className="text-center py-8 text-[#00000099]">
              No pending proposals to approve
            </div>
          ) : (
            <>
              <div className="flex flex-col space-y-4">
                {pendingProposals.map((proposal) => {
                  const propThreshold = getEffectiveThreshold(
                    proposal.metadata?.proposalType,
                    threshold,
                    detectedConfig?.procedureThresholds
                  );
                  const sigCount = proposal.signatures?.length ?? 0;
                  const isReady = sigCount >= propThreshold;
                  const isSigning = signingProposal === proposal.id;
                  const isExecuting = executingProposal === proposal.id;
                  const isSelected = selectedIds.includes(proposal.id);

                  return (
                    <div
                      key={proposal.id}
                      className={`flex flex-row items-center border-[0.5px] p-3 ${
                        isSelected ? 'border-[#FF5500] bg-[#FF5500]/5' : 'border-[rgba(0,0,0,0.2)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(proposal.id)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-dmmono text-[14px] font-[500]">
                          {proposal.metadata?.proposalType === 'p2id' ? 'SEND' :
                           proposal.metadata?.proposalType === 'consume_notes' ? 'RECEIVE' :
                           (proposal.metadata?.proposalType ?? 'UNKNOWN').toUpperCase().replace('_', ' ')}
                        </div>
                        <div className="font-dmmono text-[10px] text-gray-500">
                          ID: {proposal.id.slice(0, 16)}...
                        </div>
                      </div>
                      <div className="font-dmmono text-[12px] mr-4">
                        {sigCount}/{propThreshold} signed
                      </div>
                      {isReady ? (
                        <button
                          onClick={() => handleExecuteProposal(proposal.id)}
                          disabled={isExecuting}
                          className="bg-[#28A857] text-white px-3 py-1 text-[10px] font-dmmono disabled:opacity-50"
                        >
                          {isExecuting ? "..." : "EXECUTE"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSignProposal(proposal.id)}
                          disabled={isSigning}
                          className="bg-[#FF5500] text-white px-3 py-1 text-[10px] font-dmmono disabled:opacity-50"
                        >
                          {isSigning ? "..." : "SIGN"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedIds.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={handleSignSelected}
                    className="px-6 py-3 w-full bg-[#FF5500] text-white font-dmmono font-[500] hover:bg-[#E04A00] transition-colors"
                  >
                    SIGN SELECTED ({selectedIds.length})
                  </button>
                </div>
              )}
            </>
          )}

          <div className="w-full h-[78px] px-4 py-2 bg-[#FBE9EA] text-[#FF0000]">
            <span className="uppercase text-[16px] font-dmmono font-[500]">
              security notice
            </span>
            <div className="font-dmmono text-[12px] text-[#FF0000]">
              Please verify all transfer details carefully before approving.
              Once executed, transfers cannot be reversed.
            </div>
          </div>

          <div
            className="w-full text-center uppercase text-[20px] font-[400] font-dmmono cursor-pointer hover:text-[#FF5500] transition-colors"
            onClick={onCancel}
          >
            cancel
          </div>
        </div>
      </div>
    </div>
  );
};
