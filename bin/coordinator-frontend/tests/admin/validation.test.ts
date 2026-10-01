import { describe, it, expect } from 'vitest';
import { parseU64, parseMinBurn, parseWordHex, normalizeAccountId, ValidationError } from '@/lib/admin/validation';

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
});
describe('normalizeAccountId', () => {
  it('rejects malformed', () => { expect(() => normalizeAccountId('not-an-id', 'devnet')).toThrow(ValidationError); });
});
