import { describe, it, expect } from 'vitest';
import {
  encodeRecipeLabel, decodeRecipeLabel, deriveAdminSerial, recipeContractStatus, recipeTarget, type AdminRecipe,
} from '@/lib/admin/recipe';

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

const bridge: AdminRecipe = {
  ...r, target: 'agglayer', faucetId: '0xb1d6e', action: 'rbac_set_admin',
  actionArgs: { action: 'rbac_set_admin', role: 'PAUSER', adminRole: null },
};

it('a recipe without target is USDCx (old labels keep decoding as before)', () => {
  expect(recipeTarget(r)).toBe('usdcx');
  expect(decodeRecipeLabel(encodeRecipeLabel(r))?.target).toBeUndefined();
});
it('an AggLayer recipe gets the agg_v1_ prefix and round-trips through lowercasing', () => {
  const label = encodeRecipeLabel(bridge);
  expect(label.startsWith('agg_v1_')).toBe(true);
  expect(label).toMatch(/^[a-z0-9_]+$/);
  expect(decodeRecipeLabel(label.toLowerCase())).toEqual({ ...bridge });
  expect(recipeTarget(decodeRecipeLabel(label)!)).toBe('agglayer');
});
it('renounce round-trips', () => {
  const x: AdminRecipe = { ...bridge, action: 'rbac_renounce', actionArgs: { action: 'rbac_renounce', role: 'PAUSER' } };
  expect(decodeRecipeLabel(encodeRecipeLabel(x))).toEqual(x);
});

describe('label prefix must agree with the payload target', () => {
  it('rejects an agg_v1_ payload carried under the usdcx_v1_ prefix', () => {
    const forged = 'usdcx_v1_' + encodeRecipeLabel(bridge).slice('agg_v1_'.length);
    expect(decodeRecipeLabel(forged)).toBeNull();
  });
  it('rejects a USDCx payload (no target) carried under the agg_v1_ prefix', () => {
    const forged = 'agg_v1_' + encodeRecipeLabel(r).slice('usdcx_v1_'.length);
    expect(decodeRecipeLabel(forged)).toBeNull();
  });
});

describe('recipeContractStatus', () => {
  const configured = [{ kind: 'usdcx' as const, contractId: '0xFFF' }, { kind: 'agglayer' as const, contractId: '0xB1D6E' }];
  it('is ok when the recipe names the configured contract of its kind, case-insensitively', () => {
    expect(recipeContractStatus(r, configured)).toBe('ok');
    expect(recipeContractStatus(bridge, configured)).toBe('ok');
  });
  it('flags another contract id, or a kind this build does not configure', () => {
    expect(recipeContractStatus({ ...r, faucetId: '0xeee' }, configured)).toBe('unknown_contract');
    // A bridge recipe naming the USDCx faucet id is still unknown: ids are compared per kind.
    expect(recipeContractStatus({ ...bridge, faucetId: '0xfff' }, configured)).toBe('unknown_contract');
    expect(recipeContractStatus(bridge, [configured[0]])).toBe('unknown_contract');
  });
});

// Backward compatibility: a literal label as the pre-AggLayer encoder produced it (a recipe without
// `target`; prefix and payload encoding are unchanged, so it is byte-identical). Pinned so a future
// change to the prefix lookup cannot silently stop decoding proposals already in flight.
it('decodes a legacy usdcx_v1_ label to the recipe it was made from', () => {
  const legacy =
    'usdcx_v1_pmrhezldnfygkvtfojzws33oei5dclbcmfrxi2lpnyrduitsmjqwgx3hojqw45bcfqrhgzlomrsxeqldmnxxk3tujfs' +
    'ceorcgb4dayjrmizggm3egrstkzrwga3taobqheygcmdcgbrtazbqmuycelbcmzqxky3forewiir2eiyhqmlggjstgzbumm2went' +
    'bg44tqobqmeygemddgbsdazjqmyytairmejtgkzkgmf2wgzlujfsceorcgb4deyjsmizggmtegjstezrtgaztcmzsgmztgnbtguz' +
    'tmmzxgnqselbcnzsxi53pojvuszbchirhizltorxgk5bcfqrgcy3unfxw4qlsm5zseot3ejqwg5djn5xceorcojrgcy27m5zgc3t' +
    'ueiwce4tpnrsseorcijgewx2nifhecr2fkircyitbmnrw65loorewiir2eiyhqm3dgnsdgzjtmy2danbrgqzdimzugq2dknbwgq3' +
    'tiobuhfqweit5fqrhgylmoregk6bchirda6dbmjqweylcmfrgcytbmjqweylcmfrgcytbmjqweylcmfrgcytbmjqweylcmfrgcyt' +
    'bmjqweylcmfrgcytbmjqweylcmfrgcytbmjqweirmejrg65lomrbgy33dnnhhk3jchiytemzugu3h2';
  expect(decodeRecipeLabel(legacy)).toEqual({
    recipeVersion: 1, action: 'rbac_grant', senderAccountId: '0x0a1b2c3d4e5f60708090a0b0c0d0e0', faucetId: '0x1f2e3d4c5b6a79880a0b0c0d0e0f10',
    feeFaucetId: '0x2a2b2c2d2e2f30313233343536373a', networkId: 'testnet',
    actionArgs: { action: 'rbac_grant', role: 'BLK_MANAGER', accountId: '0x3c3d3e3f40414243444546474849ab' },
    saltHex: '0x' + 'ab'.repeat(32), boundBlockNum: 123456,
  });
  expect(recipeTarget(decodeRecipeLabel(legacy)!)).toBe('usdcx');
});
