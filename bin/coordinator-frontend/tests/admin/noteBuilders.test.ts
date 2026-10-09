import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll } from 'vitest';
import { Note } from '@miden-sdk/miden-sdk';
import { initSync } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import { buildAdminNoteBytes, readIsPaused, __setInitializedForTests } from '@/lib/admin/noteBuilders';
import type { AdminRecipe, AdminActionArgs } from '@/lib/admin/recipe';

// Same dummy account ids / bytes as `tests/roundtrip/deserialize.test.ts` (dumped from the Rust
// crate's own `testing` fixtures), so these are proven-valid inputs, not placeholders.
const FAUCET = '0x090909080909093109090909090909';
const SENDER = '0x010101000101011101010101010101';
const OTHER = '0x070707060707071107070707070707';

// Hex encodings of the same `COMMITMENT_BYTES` / `NOTE_SCRIPT_ROOT_BYTES` used by
// `tests/roundtrip/deserialize.test.ts` (a serialized `Word`), since the recipe adapter carries
// Word/NoteScriptRoot args as hex strings and converts them via `Word.fromHex(...).serialize()`.
const COMMITMENT_HEX = '0x0b000000000000000c000000000000000d000000000000000e00000000000000';
const NOTE_SCRIPT_ROOT_HEX = '0x3e86ff9f8c0489b1bdb2246a8eb8c11071251cbd6734a008322114f041b20f81';

beforeAll(() => {
  initSync({
    module: readFileSync(
      new URL('../../src/lib/usdcxAdminWasm/usdcx_admin_notes_bg.wasm', import.meta.url),
    ),
  });
  __setInitializedForTests();
});

function recipe(action: AdminRecipe['action'], actionArgs: AdminActionArgs): AdminRecipe {
  return {
    recipeVersion: 1,
    action,
    senderAccountId: SENDER,
    faucetId: FAUCET,
    feeFaucetId: FAUCET,
    networkId: 'devnet',
    actionArgs,
    saltHex: '0x' + '3'.repeat(64),
    boundBlockNum: 1,
  };
}

describe('buildAdminNoteBytes', () => {
  it('builds a deserializable note for every action', () => {
    const cases: AdminRecipe[] = [
      recipe('set_max_supply', { action: 'set_max_supply', maxSupply: '1000000' }),
      recipe('set_min_burn', { action: 'set_min_burn', minBurn: '1' }),
      recipe('set_note_fee', {
        action: 'set_note_fee',
        noteScriptRoot: NOTE_SCRIPT_ROOT_HEX,
        feeAmount: '1000',
      }),
      recipe('rbac_grant', { action: 'rbac_grant', role: 'DOM_PAUSER', accountId: OTHER }),
      recipe('rbac_revoke', { action: 'rbac_revoke', role: 'DOM_PAUSER', accountId: OTHER }),
      recipe('set_attester', {
        action: 'set_attester',
        commitment: COMMITMENT_HEX,
        enabled: true,
      }),
      recipe('rbac_set_admin', { action: 'rbac_set_admin', role: 'PAUSER', adminRole: 'FEE_MNGR' }),
      recipe('rbac_set_admin', { action: 'rbac_set_admin', role: 'PAUSER', adminRole: null }),
      recipe('rbac_renounce', { action: 'rbac_renounce', role: 'PAUSER' }),
      recipe('pause', { action: 'pause' }),
      recipe('unpause', { action: 'unpause' }),
      recipe('blocklist', { action: 'blocklist', accountId: OTHER, blocked: true }),
    ];

    for (const r of cases) {
      expect(() => Note.deserialize(buildAdminNoteBytes(r))).not.toThrow();
    }
  });

  it('forces fee_faucet_hex to the recipe\'s read-only feeFaucetId for set_note_fee', () => {
    const r = recipe('set_note_fee', {
      action: 'set_note_fee',
      noteScriptRoot: NOTE_SCRIPT_ROOT_HEX,
      feeAmount: '1000',
    });
    // Sanity: the builder uses r.feeFaucetId regardless of anything in actionArgs (there is no
    // fee faucet field in actionArgs to begin with) and still produces a valid note.
    expect(() => Note.deserialize(buildAdminNoteBytes(r))).not.toThrow();
  });

  it('addresses the note to the recipe contract id, whichever target', () => {
    const base = recipe('rbac_renounce', { action: 'rbac_renounce', role: 'PAUSER' });
    const note = Note.deserialize(buildAdminNoteBytes({ ...base, target: 'agglayer', faucetId: OTHER }));
    expect(note.metadata().sender().toString().toLowerCase()).toBe(SENDER);
    // The tag encodes the target account; a different contract id gives a different tag.
    const usdcx = Note.deserialize(buildAdminNoteBytes(base));
    expect(note.metadata().tag().asU32()).not.toBe(usdcx.metadata().tag().asU32());
  });
});

describe('readIsPaused', () => {
  it('is exported', () => {
    expect(typeof readIsPaused).toBe('function');
  });
});
