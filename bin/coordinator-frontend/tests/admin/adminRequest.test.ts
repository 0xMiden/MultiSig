import { describe, it, expect, vi } from 'vitest';
import { createAdminProposalWith } from '@/lib/admin/adminRequest';
import { decodeRecipeLabel, type AdminRecipe } from '@/lib/admin/recipe';

// `saveRecipe` touches `window.localStorage`, which may be absent under Node. It is documented
// to no-op (never throw) in that case — see `src/lib/admin/recipe.ts` — so we don't mock it here;
// we only assert on the cross-signer transport (createCustomProposal's bytes + label), which is
// what every other signer actually relies on to reconstruct the proposal.

const recipe: AdminRecipe = {
  recipeVersion: 1,
  action: 'set_max_supply',
  senderAccountId: '0xabc',
  faucetId: '0xfff',
  feeFaucetId: '0xfee',
  networkId: 'devnet',
  actionArgs: { action: 'set_max_supply', maxSupply: '1000' },
  saltHex: '0x' + '1'.repeat(64),
  boundBlockNum: 42,
};

const FIXED_BYTES = new Uint8Array([1, 2, 3, 4]);

describe('createAdminProposalWith', () => {
  it('submits the serialized request under a usdcx.v1. label and persists the recipe', async () => {
    const createCustomProposal = vi.fn().mockResolvedValue({ id: 'p1' });
    const ms = { createCustomProposal };
    const built = {
      request: { serialize: () => FIXED_BYTES },
      recipe,
    };

    const proposal = await createAdminProposalWith(ms, built, '0xnoteid');

    expect(createCustomProposal).toHaveBeenCalledTimes(1);
    const [bytes, label, opts] = createCustomProposal.mock.calls[0];
    expect(bytes).toBe(FIXED_BYTES);
    expect(typeof label).toBe('string');
    expect(label.startsWith('usdcx.v1.')).toBe(true);
    expect(opts).toEqual({});

    // The label never carries noteIdHex (it's derived, not part of the signed binding) — decoding
    // it reproduces exactly the recipe that was passed in, nothing more.
    expect(decodeRecipeLabel(label)).toEqual(recipe);

    expect(proposal).toEqual({ id: 'p1' });
  });
});
