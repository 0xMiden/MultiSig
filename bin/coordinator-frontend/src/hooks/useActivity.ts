'use client';

import { useMemo } from 'react';
import { useMultisig } from '@/contexts/MultisigContext';
import { buildActivity, type Activity } from '@/lib/history/summary';
import type { HistoryTx } from '@/hooks/useOnChainHistory';

const NO_TXS: readonly HistoryTx[] = [];

export interface ActivityView extends Activity {
  /** The on-chain list has not been fetched yet (or is being refetched with nothing shown). */
  loading: boolean;
  /** Why the on-chain list could not be fetched, if it could not. */
  error: string | null;
  refresh: () => void;
}

/** The chain-first activity view for the Transactions tab and the home page list. */
export function useActivity(): ActivityView {
  const { onChainHistory, proposals, dismissedProposalIds, proposalHistory } = useMultisig();
  const { state, refresh } = onChainHistory;
  const txs = 'txs' in state ? state.txs : NO_TXS;
  const activity = useMemo(
    () => buildActivity({ txs, proposals, dismissed: dismissedProposalIds, entries: proposalHistory }),
    [txs, proposals, dismissedProposalIds, proposalHistory],
  );
  return {
    ...activity,
    loading: state.status === 'idle' || (state.status === 'loading' && txs.length === 0),
    error: state.status === 'error' ? state.message : null,
    refresh,
  };
}
