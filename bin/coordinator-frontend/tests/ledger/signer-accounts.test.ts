import { describe, expect, it, vi } from 'vitest';
import { lookupSignerAccounts, signerAccountsFrom } from '../../src/lib/signerAccounts';

const A = '0x93a6e276fa374b417db5b93f716e0d';
const B = '0x4e6fb40fd2f6a55140df2c42dfb5b7';
const bech32 = (id: string) => (id === A ? 'mtst1a' : id === B ? 'mtst1b' : null);

describe('signerAccountsFrom', () => {
  it('lists each account once, lower-cased, with its address', () => {
    const accounts = signerAccountsFrom({ accounts: [{ accountId: B }, { accountId: A.toUpperCase().replace('0X', '0x') }, { accountId: A }] }, bech32);
    expect(accounts).toEqual([{ accountId: B, address: 'mtst1b' }, { accountId: A, address: 'mtst1a' }]);
  });

  it('keeps an account whose address cannot be derived', () => {
    expect(signerAccountsFrom({ accounts: [{ accountId: '0x1' }] }, bech32)).toEqual([{ accountId: '0x1', address: null }]);
  });
});

describe('lookupSignerAccounts', () => {
  it("asks Guardian for the signer's commitment with that signer, and maps the reply", async () => {
    const signer = { commitment: '0xabc' } as never;
    const client = { setSigner: vi.fn(), lookupAccountByKeyCommitment: vi.fn(async () => ({ accounts: [{ accountId: A }] })) };
    await expect(lookupSignerAccounts(client, signer, bech32)).resolves.toEqual([{ accountId: A, address: 'mtst1a' }]);
    expect(client.setSigner).toHaveBeenCalledWith(signer);
    expect(client.lookupAccountByKeyCommitment).toHaveBeenCalledWith('0xabc');
  });
});
