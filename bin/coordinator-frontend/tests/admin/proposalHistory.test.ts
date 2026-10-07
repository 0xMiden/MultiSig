import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Proposal } from '@openzeppelin/miden-multisig-client';
import { encodeRecipeLabel, type AdminRecipe } from '@/lib/admin/recipe';
import {
  describeProposal,
  loadHistory,
  recordObserved,
  recordExecuted,
  recordDiscarded,
  historyStats,
  historyEntries,
} from '@/lib/proposalHistory';

// The store touches `window.localStorage`, absent under Node. Install a minimal in-memory shim
// so the persistence paths actually run (the module no-ops without `window`, which would make
// every store assertion vacuously pass).
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { window?: unknown }).window = { localStorage: new MemoryStorage() };
});
afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

const ACCT = '0xAbC123';

function proposal(over: Partial<Proposal> & { id: string }): Proposal {
  return {
    id: over.id,
    accountId: ACCT,
    nonce: over.nonce ?? 1,
    status: over.status ?? 'pending',
    txSummary: '',
    signatures: over.signatures ?? [],
    metadata: over.metadata ?? { proposalType: 'p2id', description: '', requiredSignatures: 2 },
    verification: { status: 'verified' },
  } as Proposal;
}

const customRecipe: AdminRecipe = {
  recipeVersion: 1, action: 'set_max_supply', senderAccountId: '0xabc', faucetId: '0xfff',
  feeFaucetId: '0xfee', networkId: 'testnet', actionArgs: { action: 'set_max_supply', maxSupply: '5000' },
  saltHex: '0x' + '1'.repeat(64), boundBlockNum: 42,
};
const customLabel = encodeRecipeLabel(customRecipe);

function customProposal(id: string, status: Proposal['status'] = 'pending'): Proposal {
  return proposal({
    id, status,
    metadata: { proposalType: 'custom', description: '', requiredSignatures: 2, rawProposalType: customLabel },
  });
}

describe('describeProposal', () => {
  it('labels each built-in proposal type', () => {
    expect(describeProposal(proposal({ id: 'a', metadata: { proposalType: 'p2id', description: '' } }))).toBe('Send transaction');
    expect(describeProposal(proposal({ id: 'b', metadata: { proposalType: 'consume_notes', description: '', noteIds: [] } }))).toBe('Receive transaction');
    expect(describeProposal(proposal({ id: 'c', metadata: { proposalType: 'add_signer', description: '', targetThreshold: 2, targetSignerCommitments: [] } }))).toBe('Add signer');
    expect(describeProposal(proposal({ id: 'd', metadata: { proposalType: 'change_threshold', description: '', targetThreshold: 2, targetSignerCommitments: [] } }))).toBe('Change threshold');
  });

  it('decodes a custom admin proposal into its real action', () => {
    expect(describeProposal(customProposal('e'))).toBe('Set max supply');
  });

  it('falls back to a generic label for an undecodable custom proposal', () => {
    const p = proposal({ id: 'f', metadata: { proposalType: 'custom', description: '', rawProposalType: 'not_a_usdcx_label' } });
    expect(describeProposal(p)).toBe('Admin action');
  });
});

describe('recordObserved', () => {
  it('records newly-seen proposals as pending with their decoded description', () => {
    recordObserved(ACCT, [proposal({ id: 'p1', signatures: [{} as never] }), customProposal('p2')], 1000);
    const map = loadHistory(ACCT);
    expect(map.p1.status).toBe('pending');
    expect(map.p1.description).toBe('Send transaction');
    expect(map.p1.signatureCount).toBe(1);
    expect(map.p2.description).toBe('Set max supply');
    expect(map.p1.createdAt).toBe(1000);
  });

  it('refreshes signatureCount while pending but keeps the original createdAt', () => {
    recordObserved(ACCT, [proposal({ id: 'p1' })], 1000);
    recordObserved(ACCT, [proposal({ id: 'p1', signatures: [{} as never, {} as never] })], 2000);
    const e = loadHistory(ACCT).p1;
    expect(e.signatureCount).toBe(2);
    expect(e.createdAt).toBe(1000);
    expect(e.updatedAt).toBe(2000);
  });

  it('does not revert a recorded terminal status when the proposal is briefly re-observed', () => {
    recordObserved(ACCT, [proposal({ id: 'p1' })]);
    recordExecuted(ACCT, 'p1', '0xtx');
    // Guardian may still list it as pending for a moment after a local execute.
    recordObserved(ACCT, [proposal({ id: 'p1', status: 'pending' })]);
    expect(loadHistory(ACCT).p1.status).toBe('executed');
    expect(loadHistory(ACCT).p1.txId).toBe('0xtx');
  });

  it('promotes a finalized proposal to executed on observation', () => {
    recordObserved(ACCT, [proposal({ id: 'p1', status: 'finalized' })]);
    expect(loadHistory(ACCT).p1.status).toBe('executed');
  });
});

describe('recordExecuted / recordDiscarded', () => {
  it('marks executed and discarded, and ignores unknown ids', () => {
    recordObserved(ACCT, [proposal({ id: 'p1' }), proposal({ id: 'p2' })]);
    recordExecuted(ACCT, 'p1');
    recordDiscarded(ACCT, 'p2');
    const map = loadHistory(ACCT);
    expect(map.p1.status).toBe('executed');
    expect(map.p2.status).toBe('discarded');
    // Patching an id that was never observed does not create a phantom entry.
    recordExecuted(ACCT, 'never-seen');
    expect(loadHistory(ACCT)['never-seen']).toBeUndefined();
  });
});

describe('historyStats', () => {
  it('counts totals and computes an executed/total success rate', () => {
    recordObserved(ACCT, [proposal({ id: 'a' }), proposal({ id: 'b' }), proposal({ id: 'c' }), proposal({ id: 'd' })]);
    recordExecuted(ACCT, 'a');
    recordExecuted(ACCT, 'b');
    recordExecuted(ACCT, 'c');
    recordDiscarded(ACCT, 'd');
    const stats = historyStats(loadHistory(ACCT));
    expect(stats).toEqual({ total: 4, executed: 3, pending: 0, discarded: 1, successRate: 75 });
  });

  it('is zeroed with no history', () => {
    expect(historyStats({})).toEqual({ total: 0, executed: 0, pending: 0, discarded: 0, successRate: 0 });
  });
});

describe('isolation + ordering', () => {
  it('keys history by account (case-insensitively) and returns entries newest-first', () => {
    recordObserved(ACCT, [proposal({ id: 'a' })], 1000);
    recordObserved(ACCT, [proposal({ id: 'b' })], 2000);
    recordObserved('0xother', [proposal({ id: 'z' })], 1500);
    // Same account, different case, is the same store.
    expect(Object.keys(loadHistory(ACCT.toLowerCase()))).toEqual(expect.arrayContaining(['a', 'b']));
    expect(loadHistory('0xother').a).toBeUndefined();
    const ordered = historyEntries(loadHistory(ACCT)).map((e) => e.id);
    expect(ordered).toEqual(['b', 'a']);
  });
});
