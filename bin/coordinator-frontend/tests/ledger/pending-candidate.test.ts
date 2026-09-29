import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardianHttpError } from '@openzeppelin/guardian-client';
import {
  claimable,
  clearStuckCandidate,
  probeCandidate,
  UNCONFIRMED_CLAIM_DELAY_MS,
  isPendingCandidateError,
  loadStuckCandidate,
  releasePendingCandidate,
  saveStuckCandidate,
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

describe('probeCandidate', () => {
  const withStatus = (status: () => Promise<string>) => ({
    abandonCandidate: vi.fn(),
    abandonStatus: vi.fn(status),
  }) as unknown as Parameters<typeof probeCandidate>[0];

  it('reports pending only while Guardian still holds the candidate, without abandoning it', async () => {
    const multisig = withStatus(async () => 'waiting');
    await expect(probeCandidate(multisig, 1790672202448)).resolves.toBe('pending');
    expect(multisig.abandonStatus).toHaveBeenCalledWith(1790672202448);
    expect(multisig.abandonCandidate).not.toHaveBeenCalled();
  });

  it.each(['landed', 'abandoned', 'retained', 'unexpected'])('reports resolved when the delta is %s', async (status) => {
    await expect(probeCandidate(withStatus(async () => status), 1)).resolves.toBe('resolved');
  });

  it('reports unknown rather than guessing when Guardian cannot be asked', async () => {
    await expect(probeCandidate(withStatus(async () => { throw new Error('offline'); }), 1)).resolves.toBe('unknown');
  });
});

describe('claimable', () => {
  const base = { accountId: '0xa', proposalId: '0xp', nonce: 1, startedAt: 1_000_000 };

  it('never lets a fresh unconfirmed execution be claimed — another tab may still be landing it', () => {
    expect(claimable({ ...base, confirmed: false }, base.startedAt + UNCONFIRMED_CLAIM_DELAY_MS - 1)).toBe(false);
  });

  it('allows a check once the execution has been abandoned long enough, or when Guardian already confirmed it', () => {
    expect(claimable({ ...base, confirmed: false }, base.startedAt + UNCONFIRMED_CLAIM_DELAY_MS)).toBe(true);
    expect(claimable({ ...base, confirmed: true }, base.startedAt)).toBe(true);
  });
});

describe('stuck candidate storage', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  const record = { accountId: '0xAbC', proposalId: '0xp', nonce: 7, startedAt: 1, confirmed: true };

  it('round-trips per account, case-insensitively, and clears', () => {
    saveStuckCandidate(record);
    expect(loadStuckCandidate('0xabc')).toEqual(record);
    expect(loadStuckCandidate('0xdef')).toBeNull();
    clearStuckCandidate('0xABC');
    expect(loadStuckCandidate('0xabc')).toBeNull();
  });

  it('rejects a record stored under another account or with malformed fields', () => {
    store.set('stuckCandidate:0xabc', JSON.stringify({ ...record, accountId: '0xdef' }));
    expect(loadStuckCandidate('0xabc')).toBeNull();
    store.set('stuckCandidate:0xabc', JSON.stringify({ ...record, nonce: '7' }));
    expect(loadStuckCandidate('0xabc')).toBeNull();
    store.set('stuckCandidate:0xabc', JSON.stringify({ ...record, confirmed: 'yes' }));
    expect(loadStuckCandidate('0xabc')).toBeNull();
    store.set('stuckCandidate:0xabc', '{not json');
    expect(loadStuckCandidate('0xabc')).toBeNull();
  });

  it('degrades to no record when storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } });
    expect(() => saveStuckCandidate(record)).not.toThrow();
    expect(loadStuckCandidate('0xabc')).toBeNull();
    expect(() => clearStuckCandidate('0xabc')).not.toThrow();
  });
});
