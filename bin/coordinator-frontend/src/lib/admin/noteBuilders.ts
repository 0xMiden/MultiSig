import { Word } from '@miden-sdk/miden-sdk';
import init, * as wasm from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
// next.config's `asset/resource` rule gives a URL string for this `.wasm` import, which is what
// `__wbg_init({ module_or_path })` expects in the browser. The `?url` suffix is for Vitest's Vite
// dev server, which otherwise refuses to load a raw `.wasm` import at all (see `src/types/wasm.d.ts`).
import wasmUrl from '@/lib/usdcxAdminWasm/usdcx_admin_notes_bg.wasm?url';
import { deriveAdminSerial, type AdminRecipe } from '@/lib/admin/recipe';

let ready = false;

/**
 * Initializes the vendored `usdcx-admin-notes` WASM module for browser use. Idempotent: safe to
 * call on every admin-console mount. Tests never call this — they load the wasm synchronously
 * via `initSync` (see `tests/roundtrip/deserialize.test.ts`) and then call
 * `__setInitializedForTests()` below.
 */
export async function initAdminWasm(): Promise<void> {
  if (ready) return;
  await init({ module_or_path: wasmUrl });
  ready = true;
}

/**
 * Test-only hook: marks the module as initialized without touching the real async init path.
 * Node tests initialize the wasm themselves (via the module's own `initSync`, matching
 * `tests/ledger/setup.ts`'s pattern for `@miden-sdk` itself) and then call this so
 * `buildAdminNoteBytes` doesn't re-run (and doesn't need) `initAdminWasm`.
 */
export function __setInitializedForTests(): void {
  ready = true;
}

/**
 * Builds the serialized admin `Note` bytes for `r`, dispatching on `r.action` to the matching
 * vendored `build_*` export. `initAdminWasm()` (or `__setInitializedForTests()` in tests) must
 * have run first.
 *
 * u64 action args (`maxSupply`/`minBurn`/`feeAmount`) are decimal strings in the recipe and are
 * converted to `bigint` here, at the wasm boundary, never through `Number`. Word/NoteScriptRoot
 * hex args (`noteScriptRoot`/`commitment`) are converted to serialized bytes via
 * `Word.fromHex(...).serialize()`. The serial is always `deriveAdminSerial(r.saltHex)`.
 */
export function buildAdminNoteBytes(r: AdminRecipe): Uint8Array {
  const faucet = r.faucetId;
  const sender = r.senderAccountId;
  const serial = deriveAdminSerial(r.saltHex);

  switch (r.actionArgs.action) {
    case 'set_max_supply':
      return wasm.build_set_max_supply(faucet, sender, BigInt(r.actionArgs.maxSupply), serial);

    case 'set_min_burn':
      return wasm.build_set_min_burn(faucet, sender, BigInt(r.actionArgs.minBurn), serial);

    case 'set_note_fee': {
      const noteScriptRoot = Word.fromHex(r.actionArgs.noteScriptRoot).serialize();
      // fee_faucet_hex is read-only off the recipe, never part of actionArgs.
      return wasm.build_set_note_fee(
        faucet,
        sender,
        noteScriptRoot,
        r.feeFaucetId,
        BigInt(r.actionArgs.feeAmount),
        serial,
      );
    }

    case 'rbac_grant':
      return wasm.build_rbac_grant(
        faucet,
        sender,
        r.actionArgs.role,
        r.actionArgs.accountId,
        serial,
      );

    case 'rbac_revoke':
      return wasm.build_rbac_revoke(
        faucet,
        sender,
        r.actionArgs.role,
        r.actionArgs.accountId,
        serial,
      );

    case 'rbac_set_admin':
      return wasm.build_rbac_set_admin(faucet, sender, r.actionArgs.role, r.actionArgs.adminRole ?? undefined, serial);

    case 'rbac_renounce':
      return wasm.build_rbac_renounce(faucet, sender, r.actionArgs.role, serial);

    case 'set_attester': {
      const commitment = Word.fromHex(r.actionArgs.commitment).serialize();
      return wasm.build_set_attester(faucet, sender, commitment, r.actionArgs.enabled, serial);
    }

    case 'pause':
      return wasm.build_pause(faucet, sender, /* unpause = */ false, serial);

    case 'unpause':
      return wasm.build_pause(faucet, sender, /* unpause = */ true, serial);

    case 'blocklist':
      return wasm.build_blocklist(
        faucet,
        sender,
        r.actionArgs.accountId,
        /* unblock = */ !r.actionArgs.blocked,
        serial,
      );
  }
}

/**
 * Reads the faucet's current minimum burn amount (base units) from its serialized account bytes.
 * `initAdminWasm()` must have run first.
 */
export function readCurrentMinBurn(faucetBytes: Uint8Array): bigint {
  return wasm.current_min_burn(faucetBytes);
}

/**
 * Reads the faucet's current maximum issuable supply (base units) from its serialized account
 * bytes. `initAdminWasm()` must have run first.
 */
export function readCurrentMaxSupply(faucetBytes: Uint8Array): bigint {
  return wasm.current_max_supply(faucetBytes);
}

/**
 * Reads the faucet's current token supply (base units already issued) from its serialized account
 * bytes. This is the floor a new max supply must not drop below -- the faucet rejects a
 * `set_max_supply` below it. `initAdminWasm()` must have run first.
 */
export function readCurrentTokenSupply(faucetBytes: Uint8Array): bigint {
  return wasm.current_token_supply(faucetBytes);
}

/**
 * Reads the hex commitments of every attester currently enabled on the faucet (the xreserve
 * attester allowlist map) from its serialized account bytes. `initAdminWasm()` must have run first.
 */
export function readEnabledAttesters(faucetBytes: Uint8Array): string[] {
  return wasm.enabled_attesters(faucetBytes);
}

/** Whether the contract (faucet or bridge) is paused, from its serialized account bytes. */
export function readIsPaused(contractBytes: Uint8Array): boolean {
  return wasm.is_paused(contractBytes);
}

/**
 * Reads the current fee (base units) scheduled for `noteScriptRootHex` in the faucet's constant
 * fee policy, or `null` when no explicit fee is set for that script. `initAdminWasm()` must have
 * run first; `noteScriptRootHex` must be a valid 64-hex-char word.
 */
export function readNoteFee(faucetBytes: Uint8Array, noteScriptRootHex: string): bigint | null {
  const root = Word.fromHex(noteScriptRootHex).serialize();
  const fee = wasm.note_fee(faucetBytes, root);
  return fee === undefined || fee === null ? null : fee;
}
