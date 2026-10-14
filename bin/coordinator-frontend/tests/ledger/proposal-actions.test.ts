import { describe, expect, it } from 'vitest';
import { getProposalActionState } from '../../src/lib/proposalActions';

const SIGNER = `0x${'1'.repeat(64)}`;
const config = { threshold: 2, signerCommitments: [SIGNER], procedureThresholds: [] } as never;
const proposal = (nonce: number) => ({
  id: '0xp',
  nonce,
  status: 'pending',
  signatures: [],
  metadata: { proposalType: 'p2id', requiredSignatures: 2 },
  verification: { status: 'verified' },
}) as never;

describe('outdated proposals (Guardian 0.18.1 labels each with the account nonce it reaches)', () => {
  it('asks for signatures while the proposal is built on the current state', () => {
    expect(getProposalActionState(proposal(6), config, SIGNER, 0, 5n).action).toBe('sign');
  });

  it('offers to create it again once another transaction took its slot, instead of collecting signatures', () => {
    for (const accountNonce of [6n, 7n]) {
      const state = getProposalActionState(proposal(6), config, SIGNER, 0, accountNonce);
      expect(state).toMatchObject({ action: 'recreate', actionLabel: 'Create again', statusLabel: 'Outdated: another transaction was executed first' });
    }
  });

  it('never marks a proposal while the account nonce is unknown, nor an older timestamp-labelled one', () => {
    expect(getProposalActionState(proposal(6), config, SIGNER, 0, null).action).toBe('sign');
    expect(getProposalActionState(proposal(1_760_000_000_000), config, SIGNER, 0, 9n).action).toBe('sign');
  });
});
