import { describe, expect, it } from 'vitest';
import { describeSignerChange, shortHex } from '../../src/lib/proposalDescription';

describe('describeSignerChange (review finding 10)', () => {
  const a = '0xAAAA', b = '0xbbbb', c = '0xcccc';

  it('names the signer being added and the threshold after', () => {
    expect(describeSignerChange([a, b], 1, [a, b, c], 2)).toEqual({
      added: [c], removed: [], thresholdBefore: 1, thresholdAfter: 2, signersBefore: 2, signersAfter: 3,
    });
  });

  it('names the signer being removed, matching commitments case-insensitively', () => {
    expect(describeSignerChange([a, b, c], 2, ['0xaaaa', c], 2)).toMatchObject({ added: [], removed: [b], signersAfter: 2 });
  });

  it('shows a pure threshold change with no signer diff', () => {
    expect(describeSignerChange([a, b], 1, [b, a], 2)).toMatchObject({ added: [], removed: [], thresholdBefore: 1, thresholdAfter: 2 });
  });
});

describe('shortHex', () => {
  it('keeps both ends of long ids', () => {
    expect(shortHex('0xdeadc17b13b218c14cfa7801d10884')).toBe('0xdeadc1…0884');
    expect(shortHex('0xabc')).toBe('0xabc');
  });
});
