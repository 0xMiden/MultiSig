'use client';

import type { Proposal } from '@openzeppelin/miden-multisig-client';
import { useMultisig } from '@/contexts/MultisigContext';
import { useProposalRecreation } from '@/hooks/useProposalRecreation';
import { getProposalActionState } from '@/lib/proposalActions';

interface ProposalActionButtonProps {
  proposal: Proposal;
  className?: string;
}

export function ProposalActionButton({ proposal, className = '' }: ProposalActionButtonProps) {
  const {
    activeCommitment,
    detectedConfig,
    executingProposal,
    handleExecuteProposal,
    handleSignProposal,
    releasingCandidate,
    retryProposalVerification,
    signingProposal,
    syncingState,
  } = useMultisig();
  const recreateProposal = useProposalRecreation();
  const state = getProposalActionState(proposal, detectedConfig, activeCommitment);
  const signing = signingProposal === proposal.id;
  const executing = executingProposal === proposal.id;
  const busy = signing || executing || releasingCandidate || (state.action === 'retry' && syncingState);

  const runAction = async () => {
    switch (state.action) {
      case 'sign':
        await handleSignProposal(proposal.id);
        break;
      case 'execute':
        await handleExecuteProposal(proposal.id);
        break;
      case 'retry':
        await retryProposalVerification(proposal.id);
        break;
      case 'recreate':
        await recreateProposal(proposal);
        break;
      default:
        break;
    }
  };

  const label = signing
    ? 'Signing…'
    : executing
      ? 'Executing…'
      : state.action === 'retry' && syncingState
        ? 'Checking…'
        : state.actionLabel;
  const actionable = state.action !== 'none';
  const color = state.action === 'execute'
    ? 'bg-[#28A857] hover:bg-[#239E4C] text-white'
    : state.action === 'recreate'
      ? 'border border-[#FF5500] text-[#C2410C] hover:bg-[#FF55000A]'
      : 'bg-[#FF5500] hover:bg-[#E64A00] text-white';

  return (
    <button
      type="button"
      onClick={() => void runAction().catch(() => undefined)}
      disabled={state.disabled || busy}
      title={state.statusLabel}
      className={`min-h-8 rounded-[6px] px-3 text-[11px] font-[500] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5500] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 disabled:opacity-70 ${actionable ? color : ''} ${className}`}
    >
      {label}
    </button>
  );
}
