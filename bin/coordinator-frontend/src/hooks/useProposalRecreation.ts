'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Proposal } from '@openzeppelin/miden-multisig-client';
import { toast } from 'sonner';
import { useDashboardUI } from '@/contexts/DashboardUIContext';
import { formatTokenAmount, getFaucetDecimals } from '@/lib/tokenAmounts';

export function useProposalRecreation() {
  const router = useRouter();
  const {
    openSendModal,
    openReceiveModal,
    setSettingsTab,
  } = useDashboardUI();

  return useCallback(async (proposal: Proposal) => {
    switch (proposal.metadata.proposalType) {
      case 'p2id': {
        const { recipientId, faucetId, amount: baseUnits, noteType } = proposal.metadata;
        // Prefill in the token's own units; leave the amount for the user to
        // enter rather than guess a scale when the faucet can't be read.
        let amount = '';
        try {
          amount = formatTokenAmount(baseUnits, await getFaucetDecimals(faucetId));
        } catch {
          toast.error('Could not read the token details; please re-enter the amount.');
        }
        router.push('/dashboard/home');
        openSendModal({ recipientId, faucetId, amount, isPrivate: noteType === 'private' });
        break;
      }
      case 'consume_notes':
        router.push('/dashboard/home');
        openReceiveModal(proposal.metadata.noteIds);
        break;
      case 'add_signer':
      case 'remove_signer':
      case 'change_threshold':
      case 'update_procedure_threshold':
        setSettingsTab('signers');
        router.push('/dashboard/settings');
        break;
      case 'switch_guardian':
        setSettingsTab('transactionguard');
        router.push('/dashboard/settings');
        break;
      default:
        router.push('/dashboard/transactions');
    }
  }, [openReceiveModal, openSendModal, router, setSettingsTab]);
}
