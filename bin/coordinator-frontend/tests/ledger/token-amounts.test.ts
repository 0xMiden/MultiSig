import { describe, expect, it, vi } from 'vitest';
import { formatTokenAmount, parseTokenAmount } from '../../src/lib/tokenAmounts';

describe('parseTokenAmount (review C3)', () => {
  it('scales by the token decimals, not a fixed 6', () => {
    expect(parseTokenAmount('1', 6)).toBe(1_000_000n);
    expect(parseTokenAmount('1', 8)).toBe(100_000_000n);
    expect(parseTokenAmount('1.5', 2)).toBe(150n);
    expect(parseTokenAmount('0.01', 6)).toBe(10_000n);
    expect(parseTokenAmount('.5', 1)).toBe(5n);
    expect(parseTokenAmount('7', 0)).toBe(7n);
  });

  it('is exact where floating point is not', () => {
    // Number('9007199254.740993') * 1e6 rounds; string arithmetic does not.
    expect(parseTokenAmount('9007199254.740993', 6)).toBe(9_007_199_254_740_993n);
    expect(parseTokenAmount('0.000001', 6)).toBe(1n);
  });

  it('rejects more precision than the token has instead of rounding', () => {
    expect(() => parseTokenAmount('0.0000001', 6)).toThrow('at most 6 decimal places');
    expect(() => parseTokenAmount('1.5', 0)).toThrow('does not support fractional amounts');
  });

  it.each(['', ' ', '.', 'abc', '-1', '1e6', '1,000', '0', '0.000'])('rejects %j', (input) => {
    expect(() => parseTokenAmount(input, 6)).toThrow();
  });
});

describe('formatTokenAmount (review C4)', () => {
  it('formats base units in the token decimals and round-trips', () => {
    expect(formatTokenAmount(150n, 2)).toBe('1.5');
    expect(formatTokenAmount('100000000', 8)).toBe('1');
    expect(formatTokenAmount(10_000n, 6)).toBe('0.01');
    expect(formatTokenAmount(7n, 0)).toBe('7');
    expect(parseTokenAmount(formatTokenAmount(123_456_789n, 8), 8)).toBe(123_456_789n);
  });
});

describe('getFaucetDecimals timeout (review finding 22)', () => {
  it('gives up on a stalled lookup and does not cache the failure', async () => {
    vi.resetModules();
    let calls = 0;
    // Stub every SDK piece the lookup touches: a reset module graph has no
    // initialised WASM, and the node's stall is what is under test.
    vi.doMock('@miden-sdk/miden-sdk', () => ({
      AccountId: { fromHex: (hex: string) => hex },
      BasicFungibleFaucetComponent: { fromAccount: () => ({ decimals: () => 6, symbol: () => ({ toString: () => 'TST' }) }) },
      Endpoint: class {},
      RpcClient: class {
        getAccountDetails() { calls += 1; return new Promise(() => {}); }
        free() {}
      },
    }));
    const { getFaucetDecimals } = await import('../../src/lib/tokenAmounts');
    const faucet = '0x7cf0a4456218bfb111c55a10d5435a';
    await expect(getFaucetDecimals(faucet, 20)).rejects.toThrow('did not respond in time');
    await expect(getFaucetDecimals(faucet, 20)).rejects.toThrow('did not respond in time');
    expect(calls).toBe(2);
    vi.doUnmock('@miden-sdk/miden-sdk');
  });
});

describe('getTokenInfo (review finding 3)', () => {
  async function load(symbol: string, decimals = 8) {
    vi.resetModules();
    vi.doMock('@miden-sdk/miden-sdk', () => ({
      AccountId: { fromHex: (hex: string) => hex },
      BasicFungibleFaucetComponent: { fromAccount: () => ({ decimals: () => decimals, symbol: () => ({ toString: () => symbol }) }) },
      Endpoint: class {},
      RpcClient: class {
        async getAccountDetails() { return { account: () => ({}) }; }
        free() {}
      },
    }));
    return import('../../src/lib/tokenAmounts');
  }

  it("reads each token's own decimals and symbol", async () => {
    const { getTokenInfo } = await load('USDCX', 6);
    await expect(getTokenInfo('0x7cf0a4456218bfb111c55a10d5435a')).resolves.toEqual({ decimals: 6, symbol: 'USDCX' });
    vi.doUnmock('@miden-sdk/miden-sdk');
  });

  it('labels a token without a symbol by its faucet id, never by a well-known name', async () => {
    const { getTokenInfo } = await load('   ');
    await expect(getTokenInfo('0x1234567890abcdef1234567890abcd')).resolves.toEqual({ decimals: 8, symbol: '0x123456…abcd' });
    vi.doUnmock('@miden-sdk/miden-sdk');
  });
});
