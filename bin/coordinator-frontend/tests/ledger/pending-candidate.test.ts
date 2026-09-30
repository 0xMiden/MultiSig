import { describe, expect, it, vi } from 'vitest';
import { GuardianHttpError } from '@openzeppelin/guardian-client';
import {
  clearExecutionPushed,
  executionWasPushed,
  findLockedCandidate,
  isPendingCandidateError,
  markExecutionPushed,
  msUntilUnlockable,
  releasePendingCandidate,
  UNLOCK_AFTER_MS,
} from '../../src/lib/pendingCandidate';

function guardianError(status: number, code: string, message: string): GuardianHttpError {
  return new GuardianHttpError(status, 'Conflict', JSON.stringify({ code, message, meta: { retryable: false } }));
}

const noSleep = async () => {};

describe('isPendingCandidateError', () => {
  it('recognises the Guardian 0.18 conflict_pending_delta code', () => {
    const err = guardianError(409, 'conflict_pending_delta', "There's already a pending change for this account. Finish or cancel it first.");
    expect(err.code).toBe('conflict_pending_delta');
    expect(isPendingCandidateError(err)).toBe(true);
  });

  it('keeps recognising the legacy wording', () => {
    expect(isPendingCandidateError(new Error('ConflictPendingDelta'))).toBe(true);
    expect(isPendingCandidateError(new Error('non-canonical delta pending'))).toBe(true);
  });

  it('ignores unrelated Guardian conflicts and errors', () => {
    expect(isPendingCandidateError(guardianError(409, 'conflict_pending_proposal', 'proposal pending'))).toBe(false);
    expect(isPendingCandidateError(new Error('network down'))).toBe(false);
  });
});

describe('releasePendingCandidate', () => {
  it('abandons the candidate at the given nonce and polls until released', async () => {
    const multisig = {
      abandonCandidate: vi.fn(async (nonce: number) => ({ accountId: '0x1', nonce, state: 'pending' as const })),
      abandonStatus: vi.fn()
        .mockResolvedValueOnce('waiting')
        .mockResolvedValueOnce('abandoned'),
    };
    await expect(releasePendingCandidate(multisig, 1, { sleep: noSleep })).resolves.toBe('abandoned');
    expect(multisig.abandonCandidate).toHaveBeenCalledWith(1);
    expect(multisig.abandonStatus).toHaveBeenCalledTimes(2);
    expect(multisig.abandonStatus).toHaveBeenCalledWith(1);
  });

  it('returns immediately when Guardian resolves the request synchronously', async () => {
    const multisig = {
      abandonCandidate: vi.fn(async (nonce: number) => ({ accountId: '0x1', nonce, state: 'retained' as const })),
      abandonStatus: vi.fn(),
    };
    await expect(releasePendingCandidate(multisig, 4, { sleep: noSleep })).resolves.toBe('retained');
    expect(multisig.abandonStatus).not.toHaveBeenCalled();
  });

  it('reports landed instead of releasing a transaction that reached the chain', async () => {
    const multisig = {
      abandonCandidate: vi.fn(async () => { throw guardianError(409, 'GUARDIAN_CANDIDATE_LANDED', 'landed'); }),
      abandonStatus: vi.fn(),
    };
    await expect(releasePendingCandidate(multisig, 2, { sleep: noSleep })).resolves.toBe('landed');
  });

  it('times out while Guardian is still waiting, without throwing', async () => {
    const multisig = {
      abandonCandidate: vi.fn(async (nonce: number) => ({ accountId: '0x1', nonce, state: 'pending' as const })),
      abandonStatus: vi.fn(async () => 'waiting' as const),
    };
    await expect(
      releasePendingCandidate(multisig, 3, { sleep: noSleep, pollIntervalMs: 10, timeoutMs: 30 }),
    ).resolves.toBe('timeout');
    expect(multisig.abandonStatus).toHaveBeenCalledTimes(3);
  });

  it('propagates unexpected Guardian failures', async () => {
    const multisig = {
      abandonCandidate: vi.fn(async () => { throw guardianError(401, 'authentication_failed', 'nope'); }),
      abandonStatus: vi.fn(),
    };
    await expect(releasePendingCandidate(multisig, 1, { sleep: noSleep })).rejects.toBeInstanceOf(GuardianHttpError);
  });
});

describe('releasePendingCandidate cancellation', () => {
  it('stops polling once the caller is no longer interested (account switched)', async () => {
    let switched = false;
    const multisig = {
      abandonCandidate: vi.fn(async (nonce: number) => ({ accountId: '0x1', nonce, state: 'pending' as const })),
      abandonStatus: vi.fn(async () => { switched = true; return 'waiting' as const; }),
    };
    await expect(
      releasePendingCandidate(multisig, 5, { sleep: noSleep, cancelled: () => switched }),
    ).resolves.toBe('timeout');
    expect(multisig.abandonStatus).toHaveBeenCalledTimes(1);
  });
});

describe('findLockedCandidate', () => {
  const lockedAt = '2026-09-30T10:00:00.000Z';
  const withDeltas = (byNonce: Record<number, () => Promise<unknown>>) => ({
    accountId: '0xacc',
    guardian: { getDelta: vi.fn(async (_account: string, nonce: number) => byNonce[nonce]!()) },
  });
  const notFound = () => Promise.reject(guardianError(404, 'delta_not_found', 'no delta'));

  it('identifies which open proposal Guardian holds as the candidate, with its lock time', async () => {
    const multisig = withDeltas({
      1: notFound,
      2: async () => ({ status: { status: 'pending', timestamp: lockedAt } }),
      3: async () => ({ status: { status: 'candidate', timestamp: lockedAt } }),
    });
    const lookup = await findLockedCandidate(multisig, [
      { id: '0xa', nonce: 1 }, { id: '0xb', nonce: 2 }, { id: '0xc', nonce: 3 },
    ]);
    expect(lookup).toEqual({ kind: 'found', candidate: { proposalId: '0xc', nonce: 3, lockedAt: Date.parse(lockedAt) } });
    expect(multisig.guardian.getDelta).toHaveBeenCalledWith('0xacc', 3);
  });

  it('reports none when no open proposal is a candidate', async () => {
    const multisig = withDeltas({ 1: notFound, 2: async () => ({ status: { status: 'canonical', timestamp: lockedAt } }) });
    await expect(findLockedCandidate(multisig, [{ id: '0xa', nonce: 1 }, { id: '0xb', nonce: 2 }])).resolves.toEqual({ kind: 'none' });
  });

  it('reports unknown rather than guessing when Guardian cannot be asked', async () => {
    const offline = withDeltas({ 1: () => Promise.reject(new Error('offline')) });
    await expect(findLockedCandidate(offline, [{ id: '0xa', nonce: 1 }])).resolves.toMatchObject({ kind: 'unknown' });
    await expect(findLockedCandidate({ accountId: '0xacc' }, [{ id: '0xa', nonce: 1 }])).resolves.toMatchObject({ kind: 'unknown' });
    const noTime = withDeltas({ 1: async () => ({ status: { status: 'candidate' } }) });
    await expect(findLockedCandidate(noTime, [{ id: '0xa', nonce: 1 }])).resolves.toMatchObject({ kind: 'unknown' });
  });
});

describe('msUntilUnlockable', () => {
  const candidate = { proposalId: '0xp', nonce: 1, lockedAt: 1_000_000 };

  it('keeps a young lock closed: a live execution may still land it', () => {
    expect(msUntilUnlockable(candidate, candidate.lockedAt + 60_000)).toBe(UNLOCK_AFTER_MS - 60_000);
  });

  it('opens once the lock has outlived every live execution', () => {
    expect(msUntilUnlockable(candidate, candidate.lockedAt + UNLOCK_AFTER_MS)).toBe(0);
    expect(msUntilUnlockable(candidate, candidate.lockedAt + UNLOCK_AFTER_MS * 3)).toBe(0);
  });
});

describe('pushed-execution marker', () => {
  it('records per account, case-insensitively, until cleared', () => {
    clearExecutionPushed('0xAbC');
    expect(executionWasPushed('0xabc')).toBe(false);
    markExecutionPushed('0xABC');
    expect(executionWasPushed('0xabc')).toBe(true);
    expect(executionWasPushed('0xdef')).toBe(false);
    clearExecutionPushed('0xabc');
    expect(executionWasPushed('0xABC')).toBe(false);
  });
});
