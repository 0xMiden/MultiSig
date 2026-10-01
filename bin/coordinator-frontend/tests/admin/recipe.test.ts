import { describe, it, expect } from 'vitest';
import { encodeRecipeLabel, decodeRecipeLabel, deriveAdminSerial, type AdminRecipe } from '@/lib/admin/recipe';

const salt = '0x' + '1'.repeat(64);
const r: AdminRecipe = {
  recipeVersion: 1, action: 'set_max_supply', senderAccountId: '0xabc', faucetId: '0xfff',
  feeFaucetId: '0xfee', networkId: 'devnet', actionArgs: { action: 'set_max_supply', maxSupply: '1000' },
  saltHex: salt, boundBlockNum: 42,
};

it('label round-trips', () => {
  const label = encodeRecipeLabel(r);
  expect(label.startsWith('usdcx.v1.')).toBe(true);
  expect(decodeRecipeLabel(label)).toEqual({ ...r });
});
it('ignores non-usdcx labels', () => { expect(decodeRecipeLabel('p2id')).toBeNull(); });
it('serial is deterministic in the salt', () => {
  const a = deriveAdminSerial(salt), b = deriveAdminSerial(salt);
  expect(Buffer.from(a).toString('hex')).toBe(Buffer.from(b).toString('hex'));
  const c = deriveAdminSerial('0x' + '2'.repeat(64));
  expect(Buffer.from(c).toString('hex')).not.toBe(Buffer.from(a).toString('hex'));
});
