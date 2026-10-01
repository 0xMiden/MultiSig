import { describe, it, expect } from 'vitest';
import { parseU64, parseMinBurn, parseWordHex, parseNoteScriptRoot, normalizeAccountId, ValidationError } from '@/lib/admin/validation';
import { AccountId, AccountInterface, NetworkId } from '@miden-sdk/miden-sdk';

describe('parseU64', () => {
  it('accepts the max u64', () => { expect(parseU64('18446744073709551615')).toBe(18446744073709551615n); });
  it('rejects 2^64', () => { expect(() => parseU64('18446744073709551616')).toThrow(ValidationError); });
  it('rejects negative/empty/non-digit', () => {
    for (const bad of ['', '-1', '1.5', 'abc', ' ']) expect(() => parseU64(bad)).toThrow(ValidationError);
  });
});

describe('parseMinBurn', () => {
  it('rejects 0', () => { expect(() => parseMinBurn('0')).toThrow(ValidationError); });
  it('accepts 1', () => { expect(parseMinBurn('1')).toBe(1n); });
});

describe('parseWordHex', () => {
  it('accepts 64 hex chars with/without 0x', () => {
    const w = '0x' + 'a'.repeat(64);
    expect(parseWordHex(w)).toBe(w);
    expect(parseWordHex('a'.repeat(64))).toBe(w);
  });
  it('rejects wrong length', () => { expect(() => parseWordHex('0xabc')).toThrow(ValidationError); });
  it('rejects 64-hex values that exceed the Goldilocks modulus', () => {
    // 'f'.repeat(64) represents each 16-hex limb as 2^64-1, which exceeds the modulus p = 2^64-2^32+1
    expect(() => parseWordHex('f'.repeat(64))).toThrow(ValidationError);
  });
});

describe('parseNoteScriptRoot', () => {
  it('accepts 64 hex chars with/without 0x', () => {
    const w = '0x' + 'b'.repeat(64);
    expect(parseNoteScriptRoot(w)).toBe(w);
    expect(parseNoteScriptRoot('b'.repeat(64))).toBe(w);
  });
  it('rejects wrong length', () => { expect(() => parseNoteScriptRoot('0xdef')).toThrow(ValidationError); });
  it('rejects 64-hex values that exceed the Goldilocks modulus', () => {
    expect(() => parseNoteScriptRoot('f'.repeat(64))).toThrow(ValidationError);
  });
});

describe('normalizeAccountId', () => {
  it('rejects malformed', () => { expect(() => normalizeAccountId('not-an-id', 'devnet')).toThrow(ValidationError); });

  it('accepts hex account IDs on any network', () => {
    const hexId = '0xdeadc17b13b218c14cfa7801d10884';
    expect(normalizeAccountId(hexId, 'devnet')).toBe(hexId);
    expect(normalizeAccountId(hexId, 'testnet')).toBe(hexId);
  });

  it('accepts valid bech32 on matching devnet', () => {
    const hexId = '0xdeadc17b13b218c14cfa7801d10884';
    const accountId = AccountId.fromHex(hexId);
    const bech32 = accountId.toBech32(NetworkId.devnet(), AccountInterface.BasicWallet);
    accountId.free();
    expect(normalizeAccountId(bech32, 'devnet')).toBe(hexId);
  });

  it('accepts valid bech32 on matching testnet', () => {
    const hexId = '0xdeadc17b13b218c14cfa7801d10884';
    const accountId = AccountId.fromHex(hexId);
    const bech32 = accountId.toBech32(NetworkId.testnet(), AccountInterface.BasicWallet);
    accountId.free();
    expect(normalizeAccountId(bech32, 'testnet')).toBe(hexId);
  });

  it('rejects bech32 on mismatched network', () => {
    const hexId = '0xdeadc17b13b218c14cfa7801d10884';
    const accountId = AccountId.fromHex(hexId);
    const devnetBech32 = accountId.toBech32(NetworkId.devnet(), AccountInterface.BasicWallet);
    accountId.free();
    // Try to use devnet bech32 on testnet network
    expect(() => normalizeAccountId(devnetBech32, 'testnet')).toThrow(ValidationError);
  });

  it('handles uppercase bech32 input', () => {
    const hexId = '0xdeadc17b13b218c14cfa7801d10884';
    const accountId = AccountId.fromHex(hexId);
    const bech32 = accountId.toBech32(NetworkId.devnet(), AccountInterface.BasicWallet);
    accountId.free();
    const upperBech32 = bech32.toUpperCase();
    expect(normalizeAccountId(upperBech32, 'devnet')).toBe(hexId);
  });
});
