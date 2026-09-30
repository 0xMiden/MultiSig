import { GuardianHttpError } from '@openzeppelin/guardian-client';

/**
 * Whether a failed Guardian call is worth repeating unchanged: server-side or
 * network trouble, or an error Guardian itself marks retryable. Client errors
 * (bad input, limits, conflicts, auth) are not retried.
 */
export function isTransientGuardianError(error: unknown): boolean {
  if (error instanceof GuardianHttpError) {
    return error.status >= 500 || error.status === 429 || error.meta?.retryable === true;
  }
  // fetch() rejects with a TypeError when the request never got a response.
  return error instanceof TypeError && /fetch|network/i.test(error.message);
}

export interface RetryOptions {
  attempts?: number;
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: unknown) => void;
}

interface ProposalSubmitter {
  createProposal(nonce: number, txSummaryBase64: string, metadata?: unknown): Promise<unknown>;
}

/**
 * Makes the multisig re-submit a built proposal to Guardian when the push
 * fails for a transient reason. The SDK builds each proposal (nonce, salt,
 * summary) once and hands it to `createProposal`, which only pushes it; the
 * retry re-sends that exact data. Guardian keys a proposal by
 * (account, nonce, summary), so a push whose response was lost and is then
 * repeated stores the same proposal again instead of creating a duplicate.
 *
 * Returns false, leaving the SDK untouched, if the multisig lacks the method.
 */
export function retryProposalSubmission(multisig: object, options: RetryOptions = {}): boolean {
  const submitter = multisig as Partial<ProposalSubmitter>;
  const original = submitter.createProposal;
  if (typeof original !== 'function') return false;
  const {
    attempts = 3,
    delaysMs = [1_000, 3_000],
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    onRetry,
  } = options;

  submitter.createProposal = async function retrying(this: unknown, ...args: Parameters<ProposalSubmitter['createProposal']>) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await original.apply(multisig, args);
      } catch (error) {
        if (attempt >= attempts || !isTransientGuardianError(error)) throw error;
        onRetry?.(attempt, error);
        await sleep(delaysMs[Math.min(attempt - 1, delaysMs.length - 1)] ?? 0);
      }
    }
  };
  return true;
}
