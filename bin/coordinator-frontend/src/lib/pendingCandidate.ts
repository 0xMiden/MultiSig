import { GuardianHttpError, type AbandonStatus } from '@openzeppelin/guardian-client';
import type { Multisig } from '@openzeppelin/miden-multisig-client';

/**
 * Execute pushes the delta to Guardian, which co-signs it and records it as
 * the account's pending *candidate*, before the transaction is proved and
 * submitted. While a candidate exists Guardian refuses every other push for
 * the account (HTTP 409 `conflict_pending_delta`): the account is locked until
 * the candidate lands, is abandoned, or Guardian's worker gives up on it (about
 * 18 minutes after the push with Guardian's production settings).
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
 * How long a candidate must have been pending before any signer may abandon
 * it. No live execution takes this long: tokens with transfer policies expire
 * a transaction about a minute after its reference block, remote proofs take
 * seconds and the slowest in-browser proof about a minute and a half. Guardian
 * still re-checks the chain before releasing, and refuses if the transaction
 * landed.
 */
export const UNLOCK_AFTER_MS = 3 * 60_000;

/** The candidate holding an account's Guardian lock. */
export interface LockedCandidate {
  proposalId: string;
  nonce: number;
  /** When Guardian accepted the push, in ms since the epoch. */
  lockedAt: number;
}

interface DeltaReader {
  getDelta(accountId: string, nonce: number): Promise<{ status: { status: string; timestamp?: string } }>;
}

function guardianOf(multisig: object): DeltaReader | null {
  const guardian = (multisig as { guardian?: Partial<DeltaReader> }).guardian;
  return typeof guardian?.getDelta === 'function' ? (guardian as DeltaReader) : null;
}

export type CandidateLookup =
  | { kind: 'found'; candidate: LockedCandidate }
  | { kind: 'none' }
  | { kind: 'unknown'; reason: string };

/**
 * Finds which of the account's open proposals Guardian holds as the pending
 * candidate. Guardian stores an executed proposal's delta under the proposal's
 * nonce, so a read of each open proposal's nonce identifies the lock and its
 * age. Read-only: nothing is abandoned here.
 */
export async function findLockedCandidate(
  multisig: Pick<Multisig, 'accountId'> & object,
  proposals: ReadonlyArray<{ id: string; nonce: number }>,
): Promise<CandidateLookup> {
  const guardian = guardianOf(multisig);
  if (!guardian) return { kind: 'unknown', reason: 'Guardian client unavailable' };
  let failure: string | null = null;
  const seen = new Set<number>();
  for (const proposal of proposals) {
    if (seen.has(proposal.nonce)) continue;
    seen.add(proposal.nonce);
    try {
      const delta = await guardian.getDelta(multisig.accountId, proposal.nonce);
      if (delta.status.status !== 'candidate') continue;
      const lockedAt = Date.parse(delta.status.timestamp ?? '');
      if (!Number.isFinite(lockedAt)) return { kind: 'unknown', reason: 'Guardian returned no lock time' };
      return { kind: 'found', candidate: { proposalId: proposal.id, nonce: proposal.nonce, lockedAt } };
    } catch (error) {
      if (error instanceof GuardianHttpError && error.code === 'delta_not_found') continue;
      failure = error instanceof Error ? error.message : String(error);
    }
  }
  return failure ? { kind: 'unknown', reason: failure } : { kind: 'none' };
}

/** Milliseconds until any signer may unlock this candidate; 0 when it already may. */
export function msUntilUnlockable(candidate: LockedCandidate, now: number = Date.now()): number {
  return Math.max(0, candidate.lockedAt + UNLOCK_AFTER_MS - now);
}

/**
 * Proof that an execute from this page reached Guardian. The prover workflow
 * runs only after Guardian accepted the push, so its start is recorded here.
 * In memory on purpose: it only has to survive until the same execute's error
 * handler reads it.
 */
const pushedExecutions = new Map<string, number>();

export function markExecutionPushed(accountId: string): void {
  pushedExecutions.set(accountId.toLowerCase(), Date.now());
}

export function clearExecutionPushed(accountId: string): void {
  pushedExecutions.delete(accountId.toLowerCase());
}

export function executionWasPushed(accountId: string): boolean {
  return pushedExecutions.has(accountId.toLowerCase());
}

export type ReleaseOutcome = Exclude<AbandonStatus, 'waiting'> | 'timeout';

export interface ReleaseOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Stop polling early (e.g. the user switched account); resolves 'timeout'. */
  cancelled?: () => boolean;
}

type AbandonApi = Pick<Multisig, 'abandonCandidate' | 'abandonStatus'>;

/**
 * Ask Guardian to abandon the candidate at `nonce` and wait for the outcome.
 *
 * Guardian only releases the account after its worker confirms, over a short
 * quarantine, that the transaction did not land on-chain; if it did land the
 * request resolves to `'landed'` and nothing is discarded. `'retained'` means
 * the account was unlocked but the on-chain outcome is still unresolved: it
 * must never be read as "the transaction did not land". Retries are
 * idempotent, so calling this again after a timeout is safe.
 */
export async function releasePendingCandidate(
  multisig: AbandonApi,
  nonce: number,
  { pollIntervalMs = 3_000, timeoutMs = 120_000, sleep = defaultSleep, cancelled = () => false }: ReleaseOptions = {},
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
    if (cancelled()) return 'timeout';
    const status = await multisig.abandonStatus(nonce);
    if (status !== 'waiting') return status;
  }
  return 'timeout';
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
