import { describe, expect, it, vi } from 'vitest';
import { GuardianHttpError } from '@openzeppelin/guardian-client';
import { isTransientGuardianError, retryProposalSubmission } from '../../src/lib/proposalSubmission';

const guardianError = (status: number, code: string, retryable = false) =>
  new GuardianHttpError(status, 'Error', JSON.stringify({ code, message: code, meta: { retryable } }));
const noSleep = async () => {};

/** A stand-in for the SDK: every builder ends with `this.createProposal(...)`. */
function sdkLike(push: (...args: unknown[]) => Promise<unknown>) {
  const calls: unknown[][] = [];
  const multisig = {
    createProposal: vi.fn(async (...args: unknown[]) => { calls.push(args); return push(...args); }),
    async createP2idProposal() {
      return this.createProposal(1790000000000, 'c3VtbWFyeQ==', { proposalType: 'p2id' });
    },
  };
  return { multisig, calls };
}

describe('isTransientGuardianError', () => {
  it('treats server, rate-limit, retryable and network failures as transient', () => {
    expect(isTransientGuardianError(guardianError(503, 'storage_error'))).toBe(true);
    expect(isTransientGuardianError(guardianError(429, 'rate_limit_exceeded'))).toBe(true);
    expect(isTransientGuardianError(guardianError(400, 'network_error', true))).toBe(true);
    expect(isTransientGuardianError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('never retries client errors', () => {
    expect(isTransientGuardianError(guardianError(409, 'pending_proposals_limit'))).toBe(false);
    expect(isTransientGuardianError(guardianError(409, 'conflict_pending_delta'))).toBe(false);
    expect(isTransientGuardianError(guardianError(401, 'authentication_failed'))).toBe(false);
    expect(isTransientGuardianError(new Error('boom'))).toBe(false);
  });
});

describe('retryProposalSubmission', () => {
  it('re-submits the exact same proposal data after a transient failure', async () => {
    let n = 0;
    const { multisig, calls } = sdkLike(async () => {
      n += 1;
      if (n < 3) throw n === 1 ? new TypeError('Failed to fetch') : guardianError(503, 'storage_error');
      return { id: '0xproposal' };
    });
    const onRetry = vi.fn();
    expect(retryProposalSubmission(multisig, { sleep: noSleep, onRetry })).toBe(true);
    await expect(multisig.createP2idProposal()).resolves.toEqual({ id: '0xproposal' });
    expect(calls).toHaveLength(3);
    expect(calls.every((args) => JSON.stringify(args) === JSON.stringify(calls[0]))).toBe(true);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors', async () => {
    const limit = guardianError(409, 'pending_proposals_limit');
    const { multisig, calls } = sdkLike(async () => { throw limit; });
    retryProposalSubmission(multisig, { sleep: noSleep });
    await expect(multisig.createP2idProposal()).rejects.toBe(limit);
    expect(calls).toHaveLength(1);
  });

  it('gives up after the attempt limit with the last error', async () => {
    const down = guardianError(503, 'storage_error');
    const { multisig, calls } = sdkLike(async () => { throw down; });
    retryProposalSubmission(multisig, { sleep: noSleep, attempts: 3 });
    await expect(multisig.createP2idProposal()).rejects.toBe(down);
    expect(calls).toHaveLength(3);
  });

  it('leaves objects without createProposal untouched', () => {
    expect(retryProposalSubmission({})).toBe(false);
  });
});

describe('SDK drift guard', () => {
  it('every proposal builder still submits through this.createProposal', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../../node_modules/@openzeppelin/miden-multisig-client/dist/multisig.js', import.meta.url),
      'utf8',
    );
    expect(source).toContain('async createProposal(nonce, txSummaryBase64, metadata)');
    expect(source.match(/return this\.createProposal\(proposalNonce, summaryBase64, metadata\)/g)?.length ?? 0)
      .toBeGreaterThanOrEqual(8);
  });
});
