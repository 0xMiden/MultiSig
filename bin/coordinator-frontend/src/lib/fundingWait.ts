/**
 * After registration, the node sends a new account its funding note; on
 * testnet it can take a few minutes. These bound the wait: the note is checked
 * every three seconds (each check is a sync queued with the user's own calls),
 * for at most ten minutes, then the user is offered a retry.
 */
export const FUNDING_POLL_MS = 3_000;
export const FUNDING_WAIT_MS = 10 * 60_000;
/** A check failing this many times in a row ends the wait; fewer are retried. */
export const FUNDING_MAX_FAILURES = 5;

export interface FundingWaitOptions {
  /** One sync-and-look: true once the funding note is consumable. */
  check: () => Promise<boolean>;
  /** False once this wait is superseded (account switched, or a newer attempt started). */
  isCurrent: () => boolean;
  timeoutMs?: number;
  pollMs?: number;
  maxFailures?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Resolves 'found' when the note arrives, 'stopped' when superseded. Throws if
 * it has not arrived within `timeoutMs`, or with the error of a check that
 * failed `maxFailures` times in a row (one failed sync in ten minutes of
 * polling must not end the wait).
 */
export async function waitForFundingNote({
  check,
  isCurrent,
  timeoutMs = FUNDING_WAIT_MS,
  pollMs = FUNDING_POLL_MS,
  maxFailures = FUNDING_MAX_FAILURES,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: FundingWaitOptions): Promise<'found' | 'stopped'> {
  const deadline = now() + timeoutMs;
  let failures = 0;
  for (;;) {
    let found = false;
    try {
      found = await check();
      failures = 0;
    } catch (error) {
      if (++failures >= maxFailures) throw error;
    }
    if (!isCurrent()) return 'stopped';
    if (found) return 'found';
    if (now() >= deadline) {
      throw new Error(
        `The funding note has not arrived after ${Math.round(timeoutMs / 60_000)} minutes. ` +
        'Retry funding, or fund the account from the network faucet.',
      );
    }
    await sleep(pollMs);
    if (!isCurrent()) return 'stopped';
  }
}
