import { GuardianHttpError, type AbandonStatus } from '@openzeppelin/guardian-client';
import type { Multisig } from '@openzeppelin/miden-multisig-client';

/**
 * True when Guardian refused an operation because the account already has a
 * pending canonicalization candidate (HTTP 409 `conflict_pending_delta`).
 *
 * Execute pushes the delta to Guardian (which locks the account on that
 * candidate) *before* proving and submitting the transaction. If submission
 * then fails client-side, the candidate never lands and every later push is
 * refused with this error until the candidate is abandoned.
 *
 * A 409 alone does not say whose candidate it is: another cosigner may be
 * executing right now. Only a record this client wrote establishes that
 * the candidate is one this client pushed (see {@link StuckCandidate}).
 */
export function isPendingCandidateError(error: unknown): boolean {
  if (error instanceof GuardianHttpError && error.code === 'conflict_pending_delta') {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  // Pre-0.18 Guardian wording, kept for older deployments.
  return message.includes('non-canonical delta pending') || message.includes('ConflictPendingDelta');
}

/**
 * An execution this client started for `proposalId`. Written *before* the
 * execute call (so a reload or closed tab mid-execute still leaves a trace)
 * and marked `confirmed` once Guardian has shown that the candidate at
 * `nonce` — the proposal's delta nonce, which Guardian keys candidates by —
 * is still pending after this client's attempt ended.
 */
export interface StuckCandidate {
  accountId: string;
  proposalId: string;
  nonce: number;
  startedAt: number;
  confirmed: boolean;
}

/**
 * How long an unconfirmed execution must be abandoned before this client may
 * claim its candidate. Longer than an in-browser proof plus the transaction's
 * expiration window, so an attempt still running elsewhere (another tab) has
 * either landed or can no longer land by then.
 */
export const UNCONFIRMED_CLAIM_DELAY_MS = 3 * 60_000;

type AbandonApi = Pick<Multisig, 'abandonCandidate' | 'abandonStatus'>;

export type CandidateProbe = 'pending' | 'resolved' | 'unknown';

/**
 * Ask Guardian whether the delta at `nonce` is still an open candidate.
 * `'unknown'` when Guardian could not be asked, so callers never act on a guess.
 */
export async function probeCandidate(multisig: AbandonApi, nonce: number): Promise<CandidateProbe> {
  try {
    return (await multisig.abandonStatus(nonce)) === 'waiting' ? 'pending' : 'resolved';
  } catch {
    return 'unknown';
  }
}

/** Whether an unconfirmed record is old enough to be claimed after a Guardian check. */
export function claimable(record: StuckCandidate, now: number = Date.now()): boolean {
  return record.confirmed || now - record.startedAt >= UNCONFIRMED_CLAIM_DELAY_MS;
}

export type ReleaseOutcome = Exclude<AbandonStatus, 'waiting'> | 'timeout';

export interface ReleaseOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Ask Guardian to abandon the candidate at `nonce` and wait for the outcome.
 *
 * Guardian only releases the account after its worker confirms, over a short
 * quarantine, that the transaction did not land on-chain; if it did land the
 * request resolves to `'landed'` and nothing is discarded. `'retained'` means
 * the account was unlocked but the on-chain outcome is still unresolved — it
 * must never be read as "the transaction did not land". Retries are
 * idempotent, so calling this again after a timeout is safe.
 */
export async function releasePendingCandidate(
  multisig: AbandonApi,
  nonce: number,
  { pollIntervalMs = 3_000, timeoutMs = 120_000, sleep = defaultSleep }: ReleaseOptions = {},
): Promise<ReleaseOutcome> {
  try {
    const request = await multisig.abandonCandidate(nonce);
    if (request.state === 'abandoned' || request.state === 'retained') return request.state;
  } catch (error) {
    if (error instanceof GuardianHttpError && error.code === 'candidate_landed') return 'landed';
    throw error;
  }

  for (let waited = 0; waited < timeoutMs; waited += pollIntervalMs) {
    await sleep(pollIntervalMs);
    const status = await multisig.abandonStatus(nonce);
    if (status !== 'waiting') return status;
  }
  return 'timeout';
}

const STORAGE_PREFIX = 'stuckCandidate:';

/** Persist per account so a reload does not strand the user behind the lock. */
export function saveStuckCandidate(record: StuckCandidate): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + record.accountId.toLowerCase(), JSON.stringify(record));
  } catch {
    /* storage unavailable: the record lives in memory only */
  }
}

export function loadStuckCandidate(accountId: string): StuckCandidate | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + accountId.toLowerCase());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StuckCandidate>;
    if (
      typeof parsed.proposalId !== 'string' ||
      !Number.isSafeInteger(parsed.nonce) ||
      typeof parsed.startedAt !== 'number' ||
      typeof parsed.confirmed !== 'boolean' ||
      parsed.accountId?.toLowerCase() !== accountId.toLowerCase()
    ) {
      return null;
    }
    return parsed as StuckCandidate;
  } catch {
    return null;
  }
}

export function clearStuckCandidate(accountId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + accountId.toLowerCase());
  } catch {
    /* nothing to clear */
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
