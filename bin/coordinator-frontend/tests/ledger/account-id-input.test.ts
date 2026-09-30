import { describe, expect, it } from 'vitest';
import { AccountId, AccountInterface, NetworkId } from '@miden-sdk/miden-sdk';
import { toHexAccountId } from '../../src/lib/helpers';

const id = '0xdeadc17b13b218c14cfa7801d10884';

describe('toHexAccountId', () => {
  it.each([id, id.slice(2), id.toUpperCase().replace('0X', '0x'), `  ${id.slice(2).toUpperCase()}  `, `0X${id.slice(2)}`])(
    'returns the canonical 0x-lowercase form for %j',
    (input) => {
      expect(toHexAccountId(input)).toBe(id);
    },
  );

  it('produces input AccountId.fromHex accepts even without the 0x prefix', () => {
    const parsed = AccountId.fromHex(toHexAccountId(id.slice(2)));
    expect(parsed.toString()).toBe(id);
    parsed.free();
  });

  it('still converts bech32 addresses', () => {
    const parsed = AccountId.fromHex(id);
    const bech32 = parsed.toBech32(NetworkId.devnet(), AccountInterface.BasicWallet);
    expect(bech32).toMatch(/^mdev1/);
    parsed.free();
    expect(toHexAccountId(bech32)).toBe(id);
  });
});
