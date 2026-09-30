import type { ProcedureName, ProposalType } from '@openzeppelin/miden-multisig-client';

export interface ProcedureInfo {
  name: ProcedureName;
  label: string;
  description: string;
}

export const USER_PROCEDURES: ProcedureInfo[] = [
  { name: 'receive_asset', label: 'Receive Assets', description: 'Accept incoming assets' },
  { name: 'send_asset', label: 'Send Assets', description: 'Send assets to other accounts' },
  { name: 'update_signers', label: 'Update Signers', description: 'Add/remove signers or change threshold' },
  { name: 'update_guardian', label: 'Update Guardian', description: 'Change Guardian server configuration' },
];

export function getProposalProcedure(proposalType: ProposalType): ProcedureName | null {
  switch (proposalType) {
    case 'p2id':
      return 'send_asset';
    case 'consume_notes':
      return 'receive_asset';
    case 'add_signer':
    case 'remove_signer':
    case 'change_threshold':
      return 'update_signers';
    case 'switch_guardian':
      return 'update_guardian';
    case 'update_procedure_threshold':
      return 'update_procedure_threshold';
    default:
      return null;
  }
}

export function getEffectiveThreshold(
  proposalType: ProposalType,
  defaultThreshold: number,
  procedureThresholds?: Map<ProcedureName, number>,
): number {
  if (!procedureThresholds || procedureThresholds.size === 0) {
    return defaultThreshold;
  }

  const procedure = getProposalProcedure(proposalType);
  if (!procedure) {
    return defaultThreshold;
  }

  return procedureThresholds.get(procedure) ?? defaultThreshold;
}

/** What removing one signer does, as shown to the user and sent in the proposal. */
export interface RemoveSignerPlan {
  /** Signatures needed to approve the removal (the update-signers threshold). */
  approvalsRequired: number;
  remainingSigners: number;
  /** The account's default threshold after removal. */
  newThreshold: number;
  thresholdChanges: boolean;
}

/**
 * The default threshold after removing a signer is min(current threshold,
 * remaining signers): unchanged unless it would exceed the signers left.
 * Per-procedure thresholds are not the default and must never replace it.
 */
export function planRemoveSigner(
  currentThreshold: number,
  numSigners: number,
  procedureThresholds?: Map<ProcedureName, number>,
): RemoveSignerPlan {
  const remainingSigners = numSigners - 1;
  const newThreshold = Math.min(currentThreshold, remainingSigners);
  return {
    approvalsRequired: getEffectiveThreshold('remove_signer', currentThreshold, procedureThresholds),
    remainingSigners,
    newThreshold,
    thresholdChanges: newThreshold !== currentThreshold,
  };
}
