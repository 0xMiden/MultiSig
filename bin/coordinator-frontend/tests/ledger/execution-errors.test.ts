import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuardianHttpError } from '@openzeppelin/guardian-client';
import { describeExecutionError } from '../../src/lib/errors';

describe('describeExecutionError', () => {
  afterEach(() => vi.restoreAllMocks());
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  it('explains the failures seen on devnet in plain language', () => {
    quiet();
    const expired = new Error('failed to submit proven transaction: RPC error: invalid request parameters (transaction expired): transaction expired at block height 168392 but the block height limit was 168404');
    expect(describeExecutionError(expired, 'Execute failed')).toBe(
      'Execute failed: the transaction expired before it could be submitted. Proving took too long; try again.',
    );
    const aborted = new Error("failed to prove transaction: failed to prove transaction: code: 'Unknown error', message: \"JS API error: AbortError: BodyStreamBuffer was aborted\"");
    expect(describeExecutionError(aborted, 'Execute failed')).toBe(
      'Execute failed: the transaction prover did not respond. Try again in a moment.',
    );
  });

  it("explains Guardian 0.18.1's refusal of a proposal made for another account state, advice included", () => {
    quiet();
    const word = (c: string) => `0x${c.repeat(64)}`;
    const stale = new Error(`Proposal ${word('a')} was made for account state ${word('b')}, but this client's account is at ${word('c')}: sync and retry, or create the proposal again`);
    expect(describeExecutionError(stale, 'Execute failed')).toBe(
      'Execute failed: another transaction was executed first, so this proposal can no longer execute. Discard it and create it again if the change is still needed.',
    );
  });

  it('reports a local database failure as such, not as a network problem', () => {
    quiet();
    const store = new Error('failed to execute transaction: storage error: database-related non-query error: failed to fetch account snapshot: JsValue(Object({"name":"PrematureCommitError","message":"Transaction committed too early. See http://bit.ly/2kdckMn","inner":null}))');
    expect(describeExecutionError(store, 'Failed to create the receive proposal')).toBe(
      "Failed to create the receive proposal: this browser's local Miden data could not be read. Reload the page and try again.",
    );
    expect(describeExecutionError(new TypeError('Failed to fetch'), 'Execute failed')).toBe(
      'Execute failed: could not reach the network. Check your connection and try again.',
    );
  });

  it("treats only the browser's own fetch failure as a network problem", () => {
    quiet();
    expect(describeExecutionError(new Error('JS API error: TypeError: Failed to fetch'), 'Execute failed')).toMatch(/could not reach the network/);
    expect(describeExecutionError(new Error('NetworkError when attempting to fetch resource.'), 'Execute failed')).toMatch(/could not reach the network/);
    expect(describeExecutionError(new Error('failed to fetch transaction inputs from the data store: x'), 'Execute failed'))
      .not.toMatch(/could not reach the network/);
  });

  it("uses Guardian's user-safe message rather than raw bodies", () => {
    quiet();
    const err = new GuardianHttpError(403, 'Forbidden', JSON.stringify({ code: 'signer_not_authorized', message: 'This signer cannot act on the account', meta: { retryable: false } }));
    expect(describeExecutionError(err, 'Execute failed')).toBe('Execute failed: This signer cannot act on the account.');
  });

  it('keeps only a trimmed first line of unknown errors and logs the original', () => {
    const log = quiet();
    const err = new Error(`${'x'.repeat(300)}\n    at wasm-function[9783]`);
    const text = describeExecutionError(err, 'Execute failed');
    expect(text).not.toContain('wasm-function');
    expect(text.length).toBeLessThanOrEqual('Execute failed: '.length + 200);
    expect(log).toHaveBeenCalledWith('Execute failed:', err);
  });
});
