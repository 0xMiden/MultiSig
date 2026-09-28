'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Proposal } from '@openzeppelin/miden-multisig-client';
import { useDashboardUI } from '@/contexts/DashboardUIContext';

function formatBaseUnits(amount: string, decimals = 6): string {
  const units = BigInt(amount);
  const scale = BigInt(10 ** decimals);
  const whole = units / scale;
  const fraction = (units % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function useProposalRecreation() {
  const router = useRouter();
  const {
    openSendModal,
    openReceiveModal,
    setSettingsTab,
  } = useDashboardUI();

  return useCallback((proposal: Proposal) => {
    switch (proposal.metadata.proposalType) {
      case 'p2id':
        router.push('/dashboard/home');
        openSendModal({
          recipientId: proposal.metadata.recipientId,
          faucetId: proposal.metadata.faucetId,
          amount: formatBaseUnits(proposal.metadata.amount),
          isPrivate: proposal.metadata.noteType === 'private',
        });
        break;
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
