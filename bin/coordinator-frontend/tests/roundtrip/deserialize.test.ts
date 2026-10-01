// Round-trip guard: the vendored `usdcx-admin-notes` wasm bindings are built against the
// miden-protocol version of the deployed faucet (`miden-usdcx`, pinned in the crate's Cargo.toml),
// while this frontend's `@miden-sdk/miden-sdk` is pinned separately in package.json. `Note`
// serialization has broken between 0.17 release candidates more than once (an SDK on an older rc
// rejects newer bytes with `HASHLESS flag is set`), so this test exists to prove — not assume —
// that the admin-note bytes deserialize under the frontend's `Note.deserialize`. When it fails
// after a bump on either side, the two are on incompatible protocol versions.
//
// See `.superpowers/sdd/2026-09-30-usdcx-admin-notes-0.17-port/task-8-brief.md`.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { Note } from '@miden-sdk/miden-sdk';
import {
  initSync,
  build_blocklist,
  build_pause,
  build_rbac_grant,
  build_rbac_revoke,
  build_set_attester,
  build_set_max_supply,
  build_set_min_burn,
  build_set_note_fee,
  rbac_role_members,
} from '@/lib/usdcxAdminWasm/usdcx_admin_notes';

// Dummy account ids / bytes dumped from the Rust crate's own `testing` fixtures
// (`usdcx_admin_notes::testing::{faucet_and_sender, other_account}`) plus a real note-script root
// (`miden_standards::note::config::PauseConfigNote::script_root()`), so every value below is
// exactly what the crate's own Rust tests exercise — not hand-rolled bytes that only coincidentally
// have the right length.
const FAUCET_HEX = '0x090909080909093109090909090909';
const SENDER_HEX = '0x010101000101011101010101010101';
const OTHER_HEX = '0x070707060707071107070707070707';

// A serialized `Word` (4 little-endian u64 Felts: 11, 12, 13, 14) standing in for an attester
// pubkey commitment.
const COMMITMENT_BYTES = new Uint8Array([
  11, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 13, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0,
  0,
]);

// The serialized `NoteScriptRoot` of the real, standards `PauseConfigNote` script — a valid target
// for `set_note_fee`'s repricing.
const NOTE_SCRIPT_ROOT_BYTES = new Uint8Array([
  62, 134, 255, 159, 140, 4, 137, 177, 189, 178, 36, 106, 142, 184, 193, 16, 113, 37, 28, 189, 103,
  52, 160, 8, 50, 33, 20, 240, 65, 178, 15, 129,
]);

// `--target web` builds have no node-friendly entry point, so we load the `.wasm` bytes from disk
// and instantiate synchronously — the same pattern `tests/ledger/setup.ts` uses for `@miden-sdk`
// itself.
initSync({
  module: readFileSync(
    new URL('../../src/lib/usdcxAdminWasm/usdcx_admin_notes_bg.wasm', import.meta.url),
  ),
});

let serialCounter = 0n;
/** A distinct serial `Word` per call, so no two builders below share a note. */
function nextSerial(): Uint8Array {
  serialCounter += 1n;
  const bytes = new Uint8Array(32);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, serialCounter, true);
  return bytes;
}

describe('every admin note deserializes under @miden-sdk 0.17', () => {
  test('build_set_max_supply', () => {
    const bytes = build_set_max_supply(FAUCET_HEX, SENDER_HEX, 1_000_000n, nextSerial());
    expect(() => Note.deserialize(bytes)).not.toThrow();
  });

  test('build_set_note_fee', () => {
    const bytes = build_set_note_fee(
      FAUCET_HEX,
      SENDER_HEX,
      NOTE_SCRIPT_ROOT_BYTES,
      FAUCET_HEX,
      1_000n,
      nextSerial(),
    );
    expect(() => Note.deserialize(bytes)).not.toThrow();
  });

  test('build_rbac_grant', () => {
    const bytes = build_rbac_grant(FAUCET_HEX, SENDER_HEX, 'DOM_PAUSER', OTHER_HEX, nextSerial());
    expect(() => Note.deserialize(bytes)).not.toThrow();
  });

  test('build_rbac_revoke', () => {
    const bytes = build_rbac_revoke(FAUCET_HEX, SENDER_HEX, 'DOM_PAUSER', OTHER_HEX, nextSerial());
    expect(() => Note.deserialize(bytes)).not.toThrow();
  });

  test('build_pause', () => {
    const bytes = build_pause(FAUCET_HEX, SENDER_HEX, false, nextSerial());
    expect(() => Note.deserialize(bytes)).not.toThrow();
  });

  test('build_blocklist', () => {
    const bytes = build_blocklist(FAUCET_HEX, SENDER_HEX, OTHER_HEX, false, nextSerial());
    expect(() => Note.deserialize(bytes)).not.toThrow();
  });

  test('build_set_min_burn', () => {
    const bytes = build_set_min_burn(FAUCET_HEX, SENDER_HEX, 1n, nextSerial());
    expect(() => Note.deserialize(bytes)).not.toThrow();
  });

  test('build_set_attester', () => {
    const bytes = build_set_attester(
      FAUCET_HEX,
      SENDER_HEX,
      COMMITMENT_BYTES,
      true,
      nextSerial(),
    );
    expect(() => Note.deserialize(bytes)).not.toThrow();
  });
});

// Export-survival smoke check (Task 2 of the usdcx-admin-console-frontend plan): `rbac_role_members`
// is the primitive the frontend's mandatory "last-ADMIN" guardrail counts on (the shipped wasm only
// had a boolean `account_has_role`, which can't count role holders). This only proves the export
// survived re-vendoring into `@/lib/usdcxAdminWasm` — the Rust-side behavior (the RBAC map scan
// itself) is covered by `usdcx-admin-notes`'s own `rbac_role_members_lists_admins` test.
test('rbac_role_members survives vendoring', () => {
  expect(typeof rbac_role_members).toBe('function');
});
