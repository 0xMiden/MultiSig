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
  expect(label.startsWith('usdcx_v1_')).toBe(true);
  expect(decodeRecipeLabel(label)).toEqual({ ...r });
});
it('ignores non-usdcx labels', () => { expect(decodeRecipeLabel('p2id')).toBeNull(); });

// The label is carried in OpenZeppelin's custom-proposal `proposalType`, which is validated
// against ^[a-z0-9_]+$ and lowercased before storage. A label that fails either silently breaks
// every admin proposal, so guard both here rather than only in a mocked submitter.
it('label is lowercase snake_case (passes the OZ proposalType validator)', () => {
  expect(encodeRecipeLabel(r)).toMatch(/^[a-z0-9_]+$/);
});
it('decodes after the label is lowercased (OZ stores proposalType.toLowerCase())', () => {
  const label = encodeRecipeLabel(r);
  expect(decodeRecipeLabel(label.toLowerCase())).toEqual({ ...r });
});
it('serial is deterministic in the salt', () => {
  const a = deriveAdminSerial(salt), b = deriveAdminSerial(salt);
  expect(Buffer.from(a).toString('hex')).toBe(Buffer.from(b).toString('hex'));
  const c = deriveAdminSerial('0x' + '2'.repeat(64));
  expect(Buffer.from(c).toString('hex')).not.toBe(Buffer.from(a).toString('hex'));
});
