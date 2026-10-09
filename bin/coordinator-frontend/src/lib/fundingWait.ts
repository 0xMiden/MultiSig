/**
 * After registration, the node sends a new account its funding note; on
 * testnet it can take a few minutes. These bound the wait: the note is checked
 * every second, for at most ten minutes, then the user is offered a retry.
 */
export const FUNDING_POLL_MS = 1_000;
export const FUNDING_WAIT_MS = 10 * 60_000;

export interface FundingWaitOptions {
  /** One sync-and-look: true once the funding note is consumable. */
  check: () => Promise<boolean>;
  /** False once this wait is superseded (account switched, or a newer attempt started). */
  isCurrent: () => boolean;
  timeoutMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Resolves 'found' when the note arrives, 'stopped' when superseded. Throws if
 * it has not arrived within `timeoutMs`, or if a check fails.
 */
export async function waitForFundingNote({
  check,
  isCurrent,
  timeoutMs = FUNDING_WAIT_MS,
  pollMs = FUNDING_POLL_MS,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: FundingWaitOptions): Promise<'found' | 'stopped'> {
  const deadline = now() + timeoutMs;
  for (;;) {
    const found = await check();
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
