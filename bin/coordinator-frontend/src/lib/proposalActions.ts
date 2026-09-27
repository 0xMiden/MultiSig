import {
  isProposalActionable,
  type DetectedMultisigConfig,
  type Proposal,
} from '@openzeppelin/miden-multisig-client';
import { getEffectiveThreshold } from '@/lib/procedures';

export type ProposalAction = 'sign' | 'execute' | 'retry' | 'recreate' | 'none';

export interface ProposalActionState {
  action: ProposalAction;
  actionLabel: string;
  statusLabel: string;
  signatureCount: number;
  requiredSignatures: number;
  hasSigned: boolean;
  signerEligible: boolean;
  disabled: boolean;
}

function sameCommitment(left: string, right: string): boolean {
  return left.replace(/^0x/i, '').toLowerCase() === right.replace(/^0x/i, '').toLowerCase();
}

export function getProposalActionState(
  proposal: Proposal,
  config: DetectedMultisigConfig | null,
  activeCommitment: string | null,
  fallbackThreshold = 0,
): ProposalActionState {
  const signatureCount = proposal.signatures.length;
  const requiredSignatures = proposal.metadata.requiredSignatures
    ?? (config
      ? getEffectiveThreshold(
          proposal.metadata.proposalType,
          config.threshold,
          config.procedureThresholds,
        )
      : fallbackThreshold);
  const hasSigned = Boolean(
    activeCommitment
      && proposal.signatures.some((signature) => sameCommitment(signature.signerId, activeCommitment)),
  );
  const signerEligible = Boolean(
    activeCommitment
      && config?.signerCommitments.some((commitment) => sameCommitment(commitment, activeCommitment)),
  );

  const common = { signatureCount, requiredSignatures, hasSigned, signerEligible };

  if (proposal.status === 'finalized') {
    return { ...common, action: 'none', actionLabel: 'Completed', statusLabel: 'Completed', disabled: true };
  }

  if (proposal.verification.status === 'unchecked') {
    return {
      ...common,
      action: 'none',
      actionLabel: 'Checking…',
      statusLabel: 'Checking proposal…',
      disabled: true,
    };
  }

  if (proposal.verification.status === 'failed') {
    return proposal.verification.retryable
      ? {
          ...common,
          action: 'retry',
          actionLabel: 'Retry',
          statusLabel: 'Temporarily unavailable',
          disabled: false,
        }
      : {
          ...common,
          action: 'recreate',
          actionLabel: 'Create again',
          statusLabel: 'Proposal no longer valid',
          disabled: false,
        };
  }

  if (isProposalActionable(proposal)) {
    return {
      ...common,
      action: 'execute',
      actionLabel: 'Execute',
      statusLabel: 'Ready to execute',
      disabled: false,
    };
  }

  if (!activeCommitment) {
    return {
      ...common,
      action: 'none',
      actionLabel: 'Connect signer',
      statusLabel: 'Signer connection required',
      disabled: true,
    };
  }

  if (!signerEligible) {
    return {
      ...common,
      action: 'none',
      actionLabel: 'Not a signer',
      statusLabel: 'Current wallet cannot sign',
      disabled: true,
    };
  }

  if (hasSigned) {
    return {
      ...common,
      action: 'none',
      actionLabel: 'Signed',
      statusLabel: 'Your signature was added',
      disabled: true,
    };
  }

  if (requiredSignatures < 1) {
    return {
      ...common,
      action: 'none',
      actionLabel: 'Unavailable',
      statusLabel: 'Signature threshold unavailable',
      disabled: true,
    };
  }

  return {
    ...common,
    action: 'sign',
    actionLabel: 'Sign',
    statusLabel: `${signatureCount}/${requiredSignatures} signed`,
    disabled: false,
  };
}
