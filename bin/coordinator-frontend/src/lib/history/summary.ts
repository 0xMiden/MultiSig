import type { Proposal } from '@openzeppelin/miden-multisig-client';
import type { HistoryTx } from '@/hooks/useOnChainHistory';
import { describeProposal, type ProposalHistoryEntry } from '@/lib/proposalHistory';

/**
 * The Transactions tab's chain-first view of the account's activity.
 *
 * Vocabulary: a **transaction** is on chain (the node's record of what the account executed); a
 * **proposal** is anything not committed yet (Guardian's live pending list). Per-browser history
 * (`@/lib/proposalHistory`) is consulted only for what the chain cannot know: proposals this
 * browser discarded locally. Pure, so it can be unit-tested without WASM or network.
 */

/** A transaction's one-line title, shared by the History and Transactions pages. */
export function txTitle(tx: HistoryTx): string {
  if (tx.proposals.length > 0) return tx.proposals.map((p) => p.description).join(' · ');
  const kind = tx.notes.find((n) => n.kind)?.kind;
  if (kind) return kind;
  if (tx.notes.some((n) => n.role === 'admin')) return 'Admin action (not created from this browser)';
  return tx.inputNotes.length > 0 ? 'Consumed notes' : 'Transaction';
}

export interface TransactionRow {
  txIdHex: string;
  title: string;
  blockNum: number;
  /** Unix seconds of the block, once known. */
  timestamp?: number;
  /** Whether the row carries a transfer out (p2id) rather than an admin or receive action. */
  isSend: boolean;
}

export interface ProposalRow {
  id: string;
  title: string;
  proposalType: Proposal['metadata']['proposalType'];
  signatureCount: number;
  requiredSignatures: number;
}

export interface ActivityStats {
  /** On-chain transactions, all time. */
  transactions: number;
  /** Live proposals awaiting signatures or execution. */
  proposals: number;
  /** transactions / (transactions + proposals), whole percent; 0 with nothing at all. */
  executionRate: number;
}

export interface Activity {
  transactions: TransactionRow[];
  proposals: ProposalRow[];
  /** Proposals this browser discarded locally (Guardian has no delete); hidden by default. */
  discarded: ProposalHistoryEntry[];
  stats: ActivityStats;
}

export interface ActivityInput {
  /** On-chain transactions, as the history hook yields them (any order). */
  txs: readonly HistoryTx[];
  /** Guardian's live proposal list. */
  proposals: readonly Proposal[];
  /** Ids this browser cancelled; they are not pending from the user's point of view. */
  dismissed: ReadonlySet<string>;
  /** Per-browser history, for the discarded stubs. */
  entries: readonly ProposalHistoryEntry[];
}

export function buildActivity({ txs, proposals, dismissed, entries }: ActivityInput): Activity {
  const transactions: TransactionRow[] = [...txs]
    .sort((a, b) => b.blockNum - a.blockNum)
    .map((tx) => ({
      txIdHex: tx.txIdHex,
      title: txTitle(tx),
      blockNum: tx.blockNum,
      timestamp: tx.timestamp,
      isSend: tx.notes.some((n) => n.role === 'other') && tx.notes.every((n) => n.role !== 'admin'),
    }));

  const pending: ProposalRow[] = proposals
    .filter((p) => (p.status === 'pending' || p.status === 'ready') && !dismissed.has(p.id))
    .map((p) => ({
      id: p.id,
      title: describeProposal(p),
      proposalType: p.metadata.proposalType,
      signatureCount: p.signatures?.length ?? 0,
      requiredSignatures: p.metadata.requiredSignatures ?? 0,
    }));

  const discarded = entries.filter((e) => e.status === 'discarded');

  const total = transactions.length + pending.length;
  return {
    transactions,
    proposals: pending,
    discarded,
    stats: {
      transactions: transactions.length,
      proposals: pending.length,
      executionRate: total > 0 ? Math.round((transactions.length / total) * 100) : 0,
    },
  };
}
