import { describe, it, expect } from 'vitest';
import type { Proposal } from '@openzeppelin/miden-multisig-client';
import type { HistoryTx } from '@/hooks/useOnChainHistory';
import type { ProposalHistoryEntry } from '@/lib/proposalHistory';
import { buildActivity, txTitle } from '@/lib/history/summary';

// The Transactions tab is chain-first: a "transaction" is on chain, a "proposal" is anything that
// is not committed yet. These are pure and need no WASM or network.

function tx(over: Partial<HistoryTx> & { txIdHex: string; blockNum: number }): HistoryTx {
  return {
    accountIdHex: '0xacc',
    initialStateHex: '0x1',
    finalStateHex: '0x2',
    inputNotes: [],
    outputNotes: [],
    notes: [],
    proposals: [],
    ...over,
  };
}

const adminNote = (kind?: string) =>
  ({ noteIdHex: '0xn', senderHex: '0xacc', isPublic: true, tag: 1, committed: true, role: 'admin' as const, kind }) as HistoryTx['notes'][number];

function proposal(id: string, status: Proposal['status'], signatures = 1): Proposal {
  return {
    id, accountId: '0xacc', nonce: 1, status, txSummary: '',
    signatures: Array.from({ length: signatures }, (_, i) => ({ signer: `s${i}` })),
    metadata: { proposalType: 'add_signer', description: '', requiredSignatures: 2 },
    verification: { status: 'verified' },
  } as unknown as Proposal;
}

function entry(id: string, status: ProposalHistoryEntry['status']): ProposalHistoryEntry {
  return { id, proposalType: 'add_signer', description: 'Add signer', requiredSignatures: 2, signatureCount: 2, status, createdAt: 1, updatedAt: 1 };
}

describe('txTitle', () => {
  it('prefers the locally-known proposal, then the note kind, then a role-based fallback', () => {
    const withProposal = tx({ txIdHex: '0xa', blockNum: 1, proposals: [{ proposalId: 'p', description: 'Set attester', status: 'executed', noteIdHex: '0xn', txIdHex: '0xa', blockNum: 1 }] });
    expect(txTitle(withProposal)).toBe('Set attester');
    expect(txTitle(tx({ txIdHex: '0xb', blockNum: 1, notes: [adminNote('Set max supply')] }))).toBe('Set max supply');
    expect(txTitle(tx({ txIdHex: '0xc', blockNum: 1, notes: [adminNote()] }))).toBe('Admin action (not created from this browser)');
    expect(txTitle(tx({ txIdHex: '0xd', blockNum: 1, inputNotes: [{ nullifierHex: '0x0' } as HistoryTx['inputNotes'][number]] }))).toBe('Consumed notes');
    expect(txTitle(tx({ txIdHex: '0xe', blockNum: 1 }))).toBe('Transaction');
  });
});

describe('buildActivity', () => {
  const txs = [tx({ txIdHex: '0xnew', blockNum: 20, timestamp: 1700000000 }), tx({ txIdHex: '0xold', blockNum: 10 })];

  it('lists on-chain transactions newest first as executed, without a signature count', () => {
    const a = buildActivity({ txs, proposals: [], dismissed: new Set(), entries: [] });
    expect(a.transactions.map((r) => r.txIdHex)).toEqual(['0xnew', '0xold']);
    expect(a.transactions[0]).toMatchObject({ title: 'Transaction', blockNum: 20, timestamp: 1700000000 });
    expect(a.stats).toEqual({ transactions: 2, proposals: 0, executionRate: 100 });
  });

  it('lists live pending/ready Guardian proposals with their live signature count, skipping dismissed ones', () => {
    const live = [proposal('p1', 'pending', 1), proposal('p2', 'ready', 2), proposal('p3', 'pending'), proposal('p4', 'finalized')];
    const a = buildActivity({ txs, proposals: live, dismissed: new Set(['p3']), entries: [] });
    expect(a.proposals.map((r) => r.id)).toEqual(['p1', 'p2']);
    expect(a.proposals[0]).toMatchObject({ title: 'Add signer', signatureCount: 1, requiredSignatures: 2 });
    expect(a.proposals[1]).toMatchObject({ signatureCount: 2, requiredSignatures: 2 });
    expect(a.stats).toEqual({ transactions: 2, proposals: 2, executionRate: 50 });
  });

  it('keeps locally discarded proposals aside and out of the rate', () => {
    const a = buildActivity({ txs, proposals: [], dismissed: new Set(), entries: [entry('d1', 'discarded'), entry('x1', 'executed'), entry('q1', 'pending')] });
    expect(a.discarded.map((e) => e.id)).toEqual(['d1']);
    expect(a.proposals).toEqual([]);
    expect(a.stats).toEqual({ transactions: 2, proposals: 0, executionRate: 100 });
  });

  it('reports a zero rate with nothing at all', () => {
    expect(buildActivity({ txs: [], proposals: [], dismissed: new Set(), entries: [] }).stats).toEqual({ transactions: 0, proposals: 0, executionRate: 0 });
  });
});
