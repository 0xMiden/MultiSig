import { describe, expect, it } from 'vitest';
import { FUNDING_MAX_FAILURES, FUNDING_POLL_MS, FUNDING_WAIT_MS, waitForFundingNote } from '../../src/lib/fundingWait';

// A fake clock: sleep advances time instead of waiting.
function clock() {
  let t = 0;
  const sleeps: number[] = [];
  return { now: () => t, sleep: async (ms: number) => { sleeps.push(ms); t += ms; }, sleeps };
}

describe('waitForFundingNote', () => {
  it('checks every three seconds until the note arrives', async () => {
    const c = clock();
    let checks = 0;
    const outcome = await waitForFundingNote({ ...c, isCurrent: () => true, check: async () => ++checks === 4 });
    expect(outcome).toBe('found');
    expect(checks).toBe(4);
    expect(c.sleeps).toEqual([FUNDING_POLL_MS, FUNDING_POLL_MS, FUNDING_POLL_MS]);
  });

  it('gives up after ten minutes with a retryable error, instead of polling forever', async () => {
    const c = clock();
    let checks = 0;
    await expect(waitForFundingNote({ ...c, isCurrent: () => true, check: async () => { checks++; return false; } }))
      .rejects.toThrow(/not arrived after 10 minutes\. Retry funding/);
    expect(FUNDING_WAIT_MS).toBe(600_000);
    expect(c.now()).toBe(FUNDING_WAIT_MS);
    expect(checks).toBe(FUNDING_WAIT_MS / FUNDING_POLL_MS + 1);
  });

  it('stops quietly once superseded (account switched or a newer attempt)', async () => {
    const c = clock();
    let current = true;
    let checks = 0;
    const outcome = await waitForFundingNote({
      ...c,
      isCurrent: () => current,
      check: async () => { if (++checks === 3) current = false; return false; },
    });
    expect(outcome).toBe('stopped');
    expect(checks).toBe(3);
    // A superseded wait never reports the note, even if this check found it.
    expect(await waitForFundingNote({ ...clock(), isCurrent: () => false, check: async () => true })).toBe('stopped');
  });

  it('retries a failing check, and surfaces it once it keeps failing', async () => {
    const error = new Error('sync failed');
    let checks = 0;
    await expect(waitForFundingNote({ ...clock(), isCurrent: () => true, check: async () => { checks++; throw error; } })).rejects.toBe(error);
    expect(checks).toBe(FUNDING_MAX_FAILURES);
  });

  it('keeps waiting through occasional failures', async () => {
    let checks = 0;
    const outcome = await waitForFundingNote({
      ...clock(),
      isCurrent: () => true,
      // Fails every other check, never FUNDING_MAX_FAILURES times in a row.
      check: async () => { checks++; if (checks % 2 === 1 && checks < 9) throw new Error('note transport hiccup'); return checks === 10; },
    });
    expect(outcome).toBe('found');
  });
});
