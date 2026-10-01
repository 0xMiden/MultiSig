import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll } from 'vitest';
import { Note } from '@miden-sdk/miden-sdk';
import type { Proposal } from '@openzeppelin/miden-multisig-client';
import { initSync } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import { __setInitializedForTests, buildAdminNoteBytes } from '@/lib/admin/noteBuilders';
import { deriveStateFromProposal, resolveAdminNoteId } from '@/lib/admin/consumption';
import type { AdminRecipe } from '@/lib/admin/recipe';

// Same dummy account ids as `tests/admin/noteBuilders.test.ts` (dumped from the Rust crate's own
// `testing` fixtures), so these are proven-valid inputs for `buildAdminNoteBytes`.
const FAUCET = '0x090909080909093109090909090909';
const SENDER = '0x010101000101011101010101010101';

beforeAll(() => {
  initSync({
    module: readFileSync(
      new URL('../../src/lib/usdcxAdminWasm/usdcx_admin_notes_bg.wasm', import.meta.url),
    ),
  });
  __setInitializedForTests();
});

function recipe(overrides: Partial<AdminRecipe> = {}): AdminRecipe {
  return {
    recipeVersion: 1,
    action: 'set_max_supply',
    senderAccountId: SENDER,
    faucetId: FAUCET,
    feeFaucetId: FAUCET,
    networkId: 'devnet',
    actionArgs: { action: 'set_max_supply', maxSupply: '1000000' },
    saltHex: '0x' + '3'.repeat(64),
    boundBlockNum: 1,
    ...overrides,
  };
}

/** Minimal `Proposal`-shaped fixture; only `status` and `signatures.length` matter here. */
function proposal(status: Proposal['status'], signatureCount: number): Proposal {
  return {
    id: 'p1',
    accountId: '0xabc',
    nonce: 0,
    status,
    txSummary: '',
    signatures: Array.from({ length: signatureCount }, (_, i) => ({
      signerId: `signer-${i}`,
      signature: {},
      timestamp: new Date().toISOString(),
    })),
    metadata: { proposalType: 'custom', description: '', rawProposalType: 'usdcx.v1.x' },
    verification: { status: 'unchecked' },
  } as unknown as Proposal;
}

describe('deriveStateFromProposal', () => {
  it('pending with 0 signatures -> created', () => {
    expect(deriveStateFromProposal(proposal('pending', 0))).toBe('created');
  });

  it('pending with >=1 signature -> collecting', () => {
    expect(deriveStateFromProposal(proposal('pending', 1))).toBe('collecting');
    expect(deriveStateFromProposal(proposal('pending', 2))).toBe('collecting');
  });

  it('ready -> threshold_reached', () => {
    expect(deriveStateFromProposal(proposal('ready', 2))).toBe('threshold_reached');
  });

  it('finalized -> executed', () => {
    expect(deriveStateFromProposal(proposal('finalized', 2))).toBe('executed');
  });

  it('requiredSignatures refines a pending proposal that already met it to threshold_reached', () => {
    expect(deriveStateFromProposal(proposal('pending', 2), 2)).toBe('threshold_reached');
    // Below threshold stays collecting.
    expect(deriveStateFromProposal(proposal('pending', 1), 2)).toBe('collecting');
  });

  it('never returns applied or awaiting_consumption from the proposal alone', () => {
    for (const status of ['pending', 'ready', 'finalized'] as const) {
      const state = deriveStateFromProposal(proposal(status, 3));
      expect(state).not.toBe('applied');
      expect(state).not.toBe('awaiting_consumption');
    }
  });
});

describe('resolveAdminNoteId', () => {
  it('returns recipe.noteIdHex verbatim when present', () => {
    const r = recipe({ noteIdHex: '0xdeadbeef' });
    expect(resolveAdminNoteId(r)).toBe('0xdeadbeef');
  });

  it('rebuilds the note id from the recipe when noteIdHex is absent', () => {
    const r = recipe();
    const expected = Note.deserialize(buildAdminNoteBytes(r)).id().toString();
    expect(resolveAdminNoteId(r)).toBe(expected);
  });

  it('rebuild is deterministic: same recipe -> same id every time', () => {
    const r = recipe();
    expect(resolveAdminNoteId(r)).toBe(resolveAdminNoteId(r));
  });

  it('never picks a fee-note-polluted output-note array by index, regardless of ordering', () => {
    // Simulates `getOutputNotesFromTxSummary`'s output: the kernel fee note at index 0, the real
    // admin note elsewhere. `resolveAdminNoteId` must never consult such an array -- it must
    // derive the id purely from the recipe -- so the id it returns must match the admin note's
    // real id regardless of where that note sits in (or whether it even appears in) the array.
    const r = recipe();
    const adminNote = Note.deserialize(buildAdminNoteBytes(r));
    const adminNoteId = adminNote.id().toString();

    const feeNote = { id: () => ({ toString: () => '0xFEEFEEFEE' }) };
    const outputNotesFeeFirst = [feeNote, adminNote];
    const outputNotesFeeLast = [adminNote, feeNote];

    // A naive (buggy) implementation reading `outputNotes[0].id().toString()` would return the
    // fee note's id in the "fee first" ordering. The real implementation never looks at either
    // array at all.
    expect(outputNotesFeeFirst[0].id().toString()).toBe('0xFEEFEEFEE');
    expect(outputNotesFeeLast[0].id().toString()).toBe(adminNoteId);

    expect(resolveAdminNoteId(r)).toBe(adminNoteId);
    expect(resolveAdminNoteId(r)).not.toBe('0xFEEFEEFEE');
  });

  it('never calls the note builder when noteIdHex is already present', () => {
    const r = recipe({ noteIdHex: '0xdeadbeef' });
    expect(resolveAdminNoteId(r)).toBe('0xdeadbeef');
    // Sanity that the builder would have produced a *different* id for this recipe, so this
    // assertion is not vacuous -- if resolveAdminNoteId silently rebuilt, it would not return
    // the literal '0xdeadbeef' we set above.
    const rebuilt = Note.deserialize(buildAdminNoteBytes(r)).id().toString();
    expect(rebuilt).not.toBe('0xdeadbeef');
  });
});
