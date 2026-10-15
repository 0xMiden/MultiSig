# USDCx Admin Console (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a role-gated USDCx faucet admin console as a build-time variant (`NEXT_PUBLIC_APP_MODE=admin`) of the existing multisig frontend, wiring the 8 vendored admin-note WASM builders into a new custom-proposal create→sign→execute flow with RBAC guardrails and on-chain consumption tracking, deployable to Vercel on devnet for e2e.

**Architecture:** The console reuses the existing `MultisigContext` proposal machinery. Each admin action builds a serialized faucet admin `Note` (vendored WASM) wrapped in a multisig `TransactionRequest` via the OZ `multisigRequestBuilder`/`buildMultisigRequest` chain, submitted as a **custom proposal** (`createCustomProposal`). A deterministic recipe (action + args + salt + bound block), encoded into the proposal's free-form `rawProposalType` label, travels to every signer via Guardian so anyone can render human-readable details and rebuild byte-identical bytes to execute (`prepareCustomExecution` → `extendAdviceMap` → `submitTransaction`). All logic lives in node-tested `src/lib/admin/*` modules; React components stay thin.

**Tech Stack:** Next.js 15.5.26 (App Router), React 19, TypeScript, `@miden-sdk/miden-sdk@0.17.0-rc.4`, `@openzeppelin/miden-multisig-client@0.18.0-rc.2`, vendored `usdcx-admin-notes` WASM, Vitest (node env), Vercel.

**Spec:** `docs/superpowers/specs/2026-09-30-usdcx-admin-console-design.md` (v2, commit 4ea0ec0). The plan argues from this spec; executors read both.

**Base:** branch `usdcx-admin-console-impl` (Plan 1 landed: `usdcx-admin-notes` crate + vendored WASM at `bin/coordinator-frontend/src/lib/usdcxAdminWasm/`). All frontend paths below are relative to `bin/coordinator-frontend/` unless an absolute repo path is given. The crate lives at repo root `crates/usdcx-admin-notes/`.

## Global Constraints

Every task's requirements implicitly include this section.

- **Versions are fixed:** `@miden-sdk/miden-sdk` `0.17.0-rc.4`, `@openzeppelin/*` `0.18.0-rc.2`, `next` `15.5.26`. Do not bump any dependency.
- **Amounts are `BigInt` at the WASM boundary.** `u64` fields parse as `string → BigInt`, validated `0 ≤ x ≤ 2^64 − 1`. Never use JS `number` for a `u64`.
- **Build requests only via** the OZ `multisigRequestBuilder(client, {accountId, salt, boundBlockNum})` + `buildMultisigRequest(builder, saltHex, accountId)` chain (which internally calls the MidenClient `feeAwareTransactionRequestBuilder`). Never `new TransactionRequestBuilder()`. Never call `.withAuthArg(...)` or `.withFeeConversionSalt(...)` on the returned builder — each clears the multisig auth args.
- **0.17 multisig executes at the tip, no `ChainAnchor`.** The bound block is declared by `feeAwareTransactionRequestBuilder`.
- **Never re-run a builder non-deterministically.** Rebuild from the stored salt; the admin-note serial is `deriveP2idSerialNumber(Word.fromHex(saltHex)).serialize()`.
- **`TransactionSummary.outputNotes()` includes the kernel fee note.** Never assume `outputNotes()[0]` is the admin note — identify the admin note by its recipe-derived note id.
- **Role gate = `account_has_role` over the faucet `Account.serialize()` bytes.** Always distinguish "does not have role" from "could not determine" (sync/parse failure → error state, never a silent "no actions").
- **Never report an admin change as applied on mere proposal finalization.** "Applied" requires the admin note consumed/nullified at the faucet.
- **RBAC guardrails (last-ADMIN/self-lockout, role-separation, revoke-while-in-flight) are frontend-only conveniences, explicitly not protocol invariants.** The chain allows all of them.
- **`fee_sponsorship` is excluded** (v1 = 8 notes).
- **Prefer existing patterns** (`runProposalCreation`, the `handleExecuteProposal` scaffold, `ProposalDetails`, `describeExecutionError`/toast, `getOutputNotesFromTxSummary`, `useFaucetDecimals`/`TokenAmount`, `AccountInspector.fromAccount`) over new abstractions.
- **Both `wallet` and `admin` builds must compile in CI.**
- The admin config must not throw at module import when its env is unset (so the default `wallet` build still compiles); validate presence at runtime use.

## Role → action → note model (verified: `0xMiden/miden-usdcx` `e68f8bc`)

| Action | Role required | WASM builder | Admin fields |
|---|---|---|---|
| Set max supply | ADMIN | `build_set_max_supply` | `max_supply` (u64) |
| Set min burn | ADMIN | `build_set_min_burn` | `min_burn` (u64 ≥ 1) |
| Set note fee | ADMIN | `build_set_note_fee` | `note_script_root` (Word hex), `fee_faucet` (native, read-only), `fee_amount` (u64) |
| Grant role | ADMIN | `build_rbac_grant` | `role`, `target account` |
| Revoke role | ADMIN | `build_rbac_revoke` | `role`, `target account` |
| Set attester | ATTEST_ADMIN | `build_set_attester` | `commitment` (Word hex), `enabled` (bool) |
| Pause | DOM_PAUSER | `build_pause(unpause=false)` | — |
| Unpause | DOM_UNPAUSER | `build_pause(unpause=true)` | — |
| Block / Unblock | BLK_MANAGER | `build_blocklist` | `target account`, `unblock` (bool) |

Role string constants (as the WASM expects them): `ADMIN`, `ATTEST_ADMIN`, `DOM_PAUSER`, `DOM_UNPAUSER`, `BLK_MANAGER`.

## File Structure

**New (repo-root crate):**
- `crates/usdcx-admin-notes/src/wasm.rs` (modify): add `rbac_role_members`.
- `crates/usdcx-admin-notes/src/lib.rs` (modify): add `rbac_role_members` core fn.

**New (frontend `src/`):**
- `src/config/appMode.ts` — `APP_MODE`/`isAdminMode` accessor.
- `src/config/adminConfig.ts` — USDCx faucet id, native fee faucet id, network; runtime-validated.
- `src/lib/admin/roles.ts` — role constants, role→action map, `RoleStatus` evaluation.
- `src/lib/admin/validation.ts` — input validation (u64/Word/NoteScriptRoot/account-id).
- `src/lib/admin/recipe.ts` — recipe type, serial derivation, label encode/decode, localStorage store.
- `src/lib/admin/noteBuilders.ts` — WASM init singleton + `buildAdminNoteBytes(recipe)`.
- `src/lib/admin/adminRequest.ts` — `buildAdminTransactionRequest(client, recipe)`.
- `src/lib/admin/guardrails.ts` — last-ADMIN, role-separation, revoke-in-flight checks.
- `src/lib/admin/describe.ts` — `describeAdminRecipe(recipe): string`.
- `src/lib/admin/consumption.ts` — consumption state machine + note-id resolution.
- `src/hooks/useFaucetRoles.ts` — role detection hook.
- `src/hooks/useAdminNoteConsumption.ts` — consumption poller hook.
- `src/app/dashboard/admin/` — admin mask page + form components.
- `src/components/admin/AdminBanner.tsx` — network/faucet/acting-multisig/roles banner.

**Modify (frontend `src/`):**
- `src/contexts/MultisigContext.tsx` — add `handleCreateAdminProposal`, custom execute branch.
- `src/components/ProposalDetails.tsx` — add `case 'custom'`.
- `src/app/dashboard/home/page.tsx`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/components/Sidebar.tsx` — admin-mode gating.
- `src/middleware.ts` — admin-mode route protection.
- `.env.example`, `src/config/psm.ts` (CSP extra origins if needed).

**New (tests + config):**
- `tests/admin/*.test.ts` — node logic tests.
- `vitest.admin.config.ts` — node vitest config for `tests/admin/**`.
- `.github/workflows/test.yml` (modify) — `test:admin` + both-build compile check.
- `vercel.json`, `docs/DEPLOY_VERCEL.md` — deploy config + runbook.

---

### Task 1: APP_MODE + admin config

**Files:**
- Create: `src/config/appMode.ts`, `src/config/adminConfig.ts`
- Modify: `.env.example`
- Test: `tests/admin/appMode.test.ts`
- Config: `vitest.admin.config.ts` (create), `package.json` (`test:admin` script)

**Interfaces:**
- Produces: `APP_MODE: 'wallet' | 'admin'`, `isAdminMode: boolean`; `getAdminConfig(): AdminConfig` where `AdminConfig = { faucetId: string; feeFaucetId: string; networkId: string }`; `assertAdminConfig(): AdminConfig` (throws if any field empty).

- [ ] **Step 1: Create the node vitest config** `vitest.admin.config.ts` mirroring `vitest.roundtrip.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@miden-sdk/miden-sdk': path.resolve(__dirname, 'node_modules/@miden-sdk/miden-sdk/dist/st/index.js'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['tests/admin/**/*.test.ts'],
    setupFiles: ['tests/ledger/setup.ts'],
    server: { deps: { inline: [/@openzeppelin\//, /@miden-sdk\//] } },
  },
});
```

- [ ] **Step 2: Add the script** to `package.json` `scripts`: `"test:admin": "vitest run --config vitest.admin.config.ts"`.

- [ ] **Step 3: Write the failing test** `tests/admin/appMode.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('appMode', () => {
  const orig = process.env.NEXT_PUBLIC_APP_MODE;
  afterEach(() => { process.env.NEXT_PUBLIC_APP_MODE = orig; });

  it('defaults to wallet when unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_MODE;
    const mod = await import('@/config/appMode?wallet');
    expect(mod.APP_MODE).toBe('wallet');
    expect(mod.isAdminMode).toBe(false);
  });

  it('is admin only for the exact value "admin"', async () => {
    process.env.NEXT_PUBLIC_APP_MODE = 'admin';
    const mod = await import('@/config/appMode?admin');
    expect(mod.APP_MODE).toBe('admin');
    expect(mod.isAdminMode).toBe(true);
  });
});
```

(Note: the `?wallet`/`?admin` query suffixes defeat ES-module caching so both branches evaluate; if the alias rejects the suffix, split into two files instead.)

- [ ] **Step 4: Run it, verify it fails** — `npm run test:admin -- appMode` → FAIL (module missing).

- [ ] **Step 5: Implement** `src/config/appMode.ts`:

```ts
export const APP_MODE: 'wallet' | 'admin' =
  process.env.NEXT_PUBLIC_APP_MODE === 'admin' ? 'admin' : 'wallet';
export const isAdminMode = APP_MODE === 'admin';
```

- [ ] **Step 6: Implement** `src/config/adminConfig.ts`:

```ts
export interface AdminConfig { faucetId: string; feeFaucetId: string; networkId: string; }

/** Never throws at import — safe for the default wallet build. */
export function getAdminConfig(): AdminConfig {
  return {
    faucetId: process.env.NEXT_PUBLIC_USDCX_FAUCET_ID ?? '',
    feeFaucetId: process.env.NEXT_PUBLIC_USDCX_FEE_FAUCET_ID ?? '',
    networkId: process.env.NEXT_PUBLIC_MIDEN_NETWORK ?? 'devnet',
  };
}

/** Call at runtime use (admin mode only). Throws if misconfigured. */
export function assertAdminConfig(): AdminConfig {
  const c = getAdminConfig();
  if (!c.faucetId) throw new Error('NEXT_PUBLIC_USDCX_FAUCET_ID is not set');
  if (!c.feeFaucetId) throw new Error('NEXT_PUBLIC_USDCX_FEE_FAUCET_ID is not set');
  return c;
}
```

- [ ] **Step 7: Add env docs** to `.env.example`:

```
# --- USDCx Admin Console (NEXT_PUBLIC_APP_MODE=admin only) ---
# NEXT_PUBLIC_APP_MODE=admin
# NEXT_PUBLIC_USDCX_FAUCET_ID=0x...        # the faucet account this console administers
# NEXT_PUBLIC_USDCX_FEE_FAUCET_ID=0x...    # native fee faucet (read-only in set_note_fee)
```

- [ ] **Step 8: Run tests, verify pass** — `npm run test:admin -- appMode` → PASS.

- [ ] **Step 9: Commit** — `git add -A && git commit -m "feat(admin): APP_MODE + admin config + node test harness"`.

---

### Task 2: Crate + WASM — `rbac_role_members` for the last-ADMIN guardrail

**Files:**
- Modify: `crates/usdcx-admin-notes/src/lib.rs`, `crates/usdcx-admin-notes/src/wasm.rs`
- Modify (re-vendor output): `bin/coordinator-frontend/src/lib/usdcxAdminWasm/*`
- Test: `crates/usdcx-admin-notes/tests/roles.rs` (extend)

**Interfaces:**
- Produces (Rust): `pub fn rbac_role_members(account: &Account, role: &XReserveRole) -> Vec<AccountId>` (enumerates the RBAC storage map for the role).
- Produces (WASM): `rbac_role_members(faucet_account: Uint8Array, role: string) -> string[]` (hex account ids).

**Context:** `account_has_role` already reads the RBAC map at key `[Felt::ZERO, role.as_element(), account.suffix(), account.prefix().as_felt()]`. Counting members requires scanning the role's storage-map entries — follow how `account_has_role` locates the map, then iterate its entries filtering by this `role` and nonzero membership value. Read the existing `account_has_role` in `src/lib.rs` for the exact map accessor and key layout before implementing.

- [ ] **Step 1: Write the failing Rust test** in `crates/usdcx-admin-notes/tests/roles.rs` using the existing `mock_chain_with_faucet_roles` fixture (grant ADMIN to two accounts, assert the member set):

```rust
#[test]
fn rbac_role_members_lists_admins() {
    let (faucet, admin_a, admin_b) = testing::faucet_with_two_admins();
    let members = rbac_role_members(&faucet, &XReserveRole::Admin);
    let ids: std::collections::HashSet<_> = members.iter().map(|id| id.to_hex()).collect();
    assert!(ids.contains(&admin_a.id().to_hex()));
    assert!(ids.contains(&admin_b.id().to_hex()));
    assert_eq!(ids.len(), 2);
}
```

Add a `faucet_with_two_admins` fixture to `src/testing.rs` (extend the existing `faucet_with_admin` pattern — grant ADMIN to a second account).

- [ ] **Step 2: Run it, verify it fails** — `cargo test -p usdcx-admin-notes rbac_role_members_lists_admins` → FAIL (fn missing).

- [ ] **Step 3: Implement** `rbac_role_members` in `src/lib.rs` (scan the RBAC storage map; return account ids whose membership value is set for `role`). Then the WASM wrapper in `src/wasm.rs`:

```rust
#[wasm_bindgen]
pub fn rbac_role_members(faucet_account: &[u8], role: &str) -> Result<Vec<String>, JsError> {
    let account = Account::read_from_bytes(faucet_account).map_err(to_js)?;
    let role = parse_role(role).map_err(to_js)?;
    Ok(crate::rbac_role_members(&account, &role).iter().map(|id| id.to_hex()).collect())
}
```

(Match the existing `wasm.rs` error-handling and `parse_role` helpers; read the file first.)

- [ ] **Step 4: Run Rust test, verify pass** — `cargo test -p usdcx-admin-notes` → all green.

- [ ] **Step 5: Re-vendor the WASM** — from `crates/usdcx-admin-notes/`: `wasm-pack build --target web --features wasm` (wasm-pack 0.15.0), then copy `pkg/usdcx_admin_notes.{js,d.ts}`, `pkg/usdcx_admin_notes_bg.wasm{,.d.ts}` over `bin/coordinator-frontend/src/lib/usdcxAdminWasm/`. Verify the new `rbac_role_members` appears in the copied `.d.ts`.

- [ ] **Step 6: Extend the JS round-trip guard** `tests/roundtrip/deserialize.test.ts`: assert `typeof rbac_role_members === 'function'` after init (a smoke check that the export survived vendoring).

- [ ] **Step 7: Run** `npm run test:roundtrip` → PASS; `cargo clippy -p usdcx-admin-notes --all-targets` and `cargo machete` clean.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(usdcx-admin-notes): rbac_role_members + re-vendor wasm"`.

---

### Task 3: Input validation library

**Files:**
- Create: `src/lib/admin/validation.ts`
- Test: `tests/admin/validation.test.ts`

**Interfaces:**
- Produces: `parseU64(input: string): bigint` (throws `ValidationError` on empty/non-digit/`> 2^64−1`); `parseMinBurn(input: string): bigint` (as `parseU64` + `≥ 1`); `normalizeAccountId(input: string, networkId: string): string` (canonical hex via `AccountId.fromHex`/`fromBech32`, rejects wrong-network bech32); `parseWordHex(input: string): string` (validates a 32-byte / 64-hex-char Word, returns `0x`-normalized); `parseNoteScriptRoot(input: string): string` (same shape as a Word). `class ValidationError extends Error`.

- [ ] **Step 1: Write the failing test** `tests/admin/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseU64, parseMinBurn, parseWordHex, normalizeAccountId, ValidationError } from '@/lib/admin/validation';

describe('parseU64', () => {
  it('accepts the max u64', () => { expect(parseU64('18446744073709551615')).toBe(18446744073709551615n); });
  it('rejects 2^64', () => { expect(() => parseU64('18446744073709551616')).toThrow(ValidationError); });
  it('rejects negative/empty/non-digit', () => {
    for (const bad of ['', '-1', '1.5', 'abc', ' ']) expect(() => parseU64(bad)).toThrow(ValidationError);
  });
});
describe('parseMinBurn', () => {
  it('rejects 0', () => { expect(() => parseMinBurn('0')).toThrow(ValidationError); });
  it('accepts 1', () => { expect(parseMinBurn('1')).toBe(1n); });
});
describe('parseWordHex', () => {
  it('accepts 64 hex chars with/without 0x', () => {
    const w = '0x' + 'a'.repeat(64);
    expect(parseWordHex(w)).toBe(w);
    expect(parseWordHex('a'.repeat(64))).toBe(w);
  });
  it('rejects wrong length', () => { expect(() => parseWordHex('0xabc')).toThrow(ValidationError); });
});
describe('normalizeAccountId', () => {
  it('rejects malformed', () => { expect(() => normalizeAccountId('not-an-id', 'devnet')).toThrow(ValidationError); });
});
```

- [ ] **Step 2: Run it, verify it fails** — `npm run test:admin -- validation` → FAIL.

- [ ] **Step 3: Implement** `src/lib/admin/validation.ts`. Use `BigInt(input)` only after a `^[0-9]+$` guard (BigInt accepts `-`/`0x`/whitespace otherwise). For account ids, try `AccountId.fromHex` then `AccountId.fromBech32` (both throw on invalid); return `.toString()` (canonical hex). `parseWordHex`/`parseNoteScriptRoot`: strip `0x`, assert `/^[0-9a-fA-F]{64}$/`, return lowercased `0x`-prefixed; cross-check with `Word.fromHex` (throws if a field element exceeds the modulus).

```ts
const U64_MAX = (1n << 64n) - 1n;
export class ValidationError extends Error {}
export function parseU64(input: string): bigint {
  if (!/^[0-9]+$/.test(input.trim())) throw new ValidationError('Enter a whole number');
  const v = BigInt(input.trim());
  if (v < 0n || v > U64_MAX) throw new ValidationError('Value must fit in a u64');
  return v;
}
```

- [ ] **Step 4: Run tests, verify pass** — `npm run test:admin -- validation` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(admin): input validation library"`.

---

### Task 4: Admin recipe — type, serial derivation, label codec, persistence

**Files:**
- Create: `src/lib/admin/recipe.ts`
- Test: `tests/admin/recipe.test.ts`

**Interfaces:**
- Consumes: Task 3 validators (for the typed `actionArgs`).
- Produces:
  - `type AdminAction = 'set_max_supply' | 'set_min_burn' | 'set_note_fee' | 'rbac_grant' | 'rbac_revoke' | 'set_attester' | 'pause' | 'unpause' | 'blocklist'`
  - `interface AdminRecipe { recipeVersion: 1; action: AdminAction; senderAccountId: string; faucetId: string; feeFaucetId: string; networkId: string; actionArgs: AdminActionArgs; saltHex: string; boundBlockNum: number; noteIdHex?: string }` (`actionArgs` a discriminated union keyed by `action`; `u64` args stored as decimal strings, never numbers).
  - `deriveAdminSerial(saltHex: string): Uint8Array` — `deriveP2idSerialNumber(Word.fromHex(saltHex)).serialize()`.
  - `encodeRecipeLabel(r: AdminRecipe): string` → `"usdcx.v1." + base64url(JSON.stringify(r without noteIdHex))`.
  - `decodeRecipeLabel(label: string): AdminRecipe | null` (null if not a `usdcx.v1.` label).
  - `saveRecipe(proposalId: string, r: AdminRecipe): void` / `loadRecipe(proposalId: string): AdminRecipe | null` (localStorage key `usdcxAdminRecipe:<proposalId>`).

**Note on the deep import:** `deriveP2idSerialNumber` is not barrel-exported; import it from `@openzeppelin/miden-multisig-client/dist/transaction/p2id` (verified present). `Word` from `@miden-sdk/miden-sdk`.

- [ ] **Step 1: Write the failing test** `tests/admin/recipe.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it, verify it fails** — `npm run test:admin -- recipe` → FAIL.

- [ ] **Step 3: Implement** `src/lib/admin/recipe.ts`. Use `base64url` without padding; the encoded recipe must exclude `noteIdHex` (derived, not part of the signed binding). For localStorage, guard with `typeof window !== 'undefined'` and wrap read/write in try/catch (SSR + private-mode safety).

- [ ] **Step 4: Run tests, verify pass** — `npm run test:admin -- recipe` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(admin): deterministic recipe + label codec + persistence"`.

---

### Task 5: Admin note builder adapter (WASM init + dispatch)

**Files:**
- Create: `src/lib/admin/noteBuilders.ts`
- Test: `tests/admin/noteBuilders.test.ts`

**Interfaces:**
- Consumes: Task 4 `AdminRecipe` + `deriveAdminSerial`; the vendored WASM `build_*` + `account_has_role` + `rbac_role_members`.
- Produces:
  - `initAdminWasm(): Promise<void>` — idempotent; browser uses async `__wbg_init({ module_or_path: wasmUrl })`, where `wasmUrl` is the `asset/resource` import of `usdcx_admin_notes_bg.wasm`. In node/test, callers use `tests/ledger/setup`-style `initSync` instead (the adapter exposes a `setInitialized()` hook for tests).
  - `buildAdminNoteBytes(r: AdminRecipe): Uint8Array` — dispatches on `r.action` to the correct `build_*`, passing validated args and `deriveAdminSerial(r.saltHex)` as the serial. For `set_note_fee`, `fee_faucet_hex` is forced to `r.feeFaucetId` (read-only).

- [ ] **Step 1: Write the failing test** `tests/admin/noteBuilders.test.ts` (node; init the WASM sync like `tests/roundtrip/deserialize.test.ts` does, then build each action and assert `Note.deserialize` succeeds):

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { Note } from '@miden-sdk/miden-sdk';
import { initSync } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import { buildAdminNoteBytes, __setInitializedForTests } from '@/lib/admin/noteBuilders';
import type { AdminRecipe } from '@/lib/admin/recipe';

const FAUCET = '0x...'; const SENDER = '0x...'; // use the fixtures from tests/roundtrip/deserialize.test.ts
beforeAll(() => {
  initSync({ module: readFileSync(new URL('../../src/lib/usdcxAdminWasm/usdcx_admin_notes_bg.wasm', import.meta.url)) });
  __setInitializedForTests();
});

function recipe(action: AdminRecipe['action'], actionArgs: any): AdminRecipe {
  return { recipeVersion: 1, action, senderAccountId: SENDER, faucetId: FAUCET, feeFaucetId: FAUCET,
    networkId: 'devnet', actionArgs, saltHex: '0x' + '3'.repeat(64), boundBlockNum: 1 };
}

it('builds a deserializable note for every action', () => {
  const cases: AdminRecipe[] = [
    recipe('set_max_supply', { action: 'set_max_supply', maxSupply: '1000' }),
    recipe('pause', { action: 'pause' }),
    recipe('unpause', { action: 'unpause' }),
    // ...all 8 actions (copy arg shapes from tests/roundtrip/deserialize.test.ts)
  ];
  for (const r of cases) expect(() => Note.deserialize(buildAdminNoteBytes(r))).not.toThrow();
});
```

(Reuse the exact `FAUCET`/`SENDER`/arg fixtures already proven in `tests/roundtrip/deserialize.test.ts` — read that file for the valid hex values.)

- [ ] **Step 2: Run it, verify it fails** — `npm run test:admin -- noteBuilders` → FAIL.

- [ ] **Step 3: Implement** `src/lib/admin/noteBuilders.ts`. The wasm URL import for the browser path:

```ts
import init, * as wasm from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
// next.config asset/resource gives a URL string for the .wasm import:
import wasmUrl from '@/lib/usdcxAdminWasm/usdcx_admin_notes_bg.wasm';
let ready = false;
export async function initAdminWasm() { if (ready) return; await init({ module_or_path: wasmUrl }); ready = true; }
export function __setInitializedForTests() { ready = true; }
```

Add a TypeScript module declaration for `*.wasm` imports if not present (`src/types/wasm.d.ts`: `declare module '*.wasm' { const url: string; export default url; }`). The dispatch maps each `action` to its `build_*` with args from `r.actionArgs` (BigInt for u64, `Uint8Array` from `Word.fromHex(...).serialize()` for Word/NoteScriptRoot args).

- [ ] **Step 4: Run tests, verify pass** — `npm run test:admin -- noteBuilders` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(admin): wasm note-builder adapter"`.

---

### Task 6: Role evaluation + `useFaucetRoles`

**Files:**
- Create: `src/lib/admin/roles.ts`, `src/hooks/useFaucetRoles.ts`
- Test: `tests/admin/roles.test.ts`

**Interfaces:**
- Consumes: WASM `account_has_role`, `rbac_role_members`; `MidenClient` from context.
- Produces:
  - `const ROLES = ['ADMIN','ATTEST_ADMIN','DOM_PAUSER','DOM_UNPAUSER','BLK_MANAGER'] as const; type Role = typeof ROLES[number]`.
  - `const ACTION_ROLE: Record<AdminAction, Role>` (the table above; `unpause → DOM_UNPAUSER`, `pause → DOM_PAUSER`).
  - `evaluateRoles(faucetBytes: Uint8Array, accountHex: string): Record<Role, boolean>` (pure, over already-fetched bytes).
  - `type RolesState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; roles: Record<Role, boolean> }`.
  - `useFaucetRoles(): RolesState` — fetches the faucet `Account` (`client.accounts.get(faucetId)`, falling back to an `RpcClient.getAccountDetails(AccountId.fromHex(faucetId)).account()` fetch like `tokenAmounts.ts` when the store returns `null`), `.serialize()`, evaluates roles for `activeCommitment`'s account. Any fetch/parse failure → `status:'error'` (never a silent all-false).

- [ ] **Step 1: Write the failing test** `tests/admin/roles.test.ts` — exercise `evaluateRoles` over the Task 2 faucet fixture bytes (build a faucet-with-admin account in a small Rust-exported fixture, or reuse the roundtrip faucet bytes), asserting the ADMIN holder maps to `{ADMIN:true,...}` and a non-holder to all-false; and assert `ACTION_ROLE.unpause === 'DOM_UNPAUSER'`.

```ts
import { describe, it, expect } from 'vitest';
import { ACTION_ROLE } from '@/lib/admin/roles';
it('maps unpause to DOM_UNPAUSER and pause to DOM_PAUSER', () => {
  expect(ACTION_ROLE.unpause).toBe('DOM_UNPAUSER');
  expect(ACTION_ROLE.pause).toBe('DOM_PAUSER');
});
// evaluateRoles test: init wasm (as Task 5), feed serialized faucet + known admin hex, assert roles.
```

- [ ] **Step 2: Run it, verify it fails** — `npm run test:admin -- roles` → FAIL.

- [ ] **Step 3: Implement** `roles.ts` (pure `evaluateRoles` over `account_has_role` per role) and `useFaucetRoles.ts` (the fetch+error-discrimination hook; depends on `useMultisig()` for the client + `activeCommitment`, and `getAdminConfig().faucetId`). Resolve the acting account id from the loaded `multisig.account.id()` (the acting multisig), not the signer commitment.

- [ ] **Step 4: Run tests, verify pass** — `npm run test:admin -- roles` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(admin): role evaluation + useFaucetRoles"`.

---

### Task 7: RBAC guardrails

**Files:**
- Create: `src/lib/admin/guardrails.ts`
- Test: `tests/admin/guardrails.test.ts`

**Interfaces:**
- Consumes: WASM `rbac_role_members`; `AdminRecipe`; the set of in-flight proposals.
- Produces:
  - `type GuardrailResult = { level: 'ok' } | { level: 'warn'; message: string } | { level: 'block'; message: string }`.
  - `checkLastAdmin(faucetBytes, actingAccountHex, recipe): GuardrailResult` — for `rbac_revoke` of `ADMIN`: compute `rbac_role_members(faucet,'ADMIN')`; if revoking the target drops the set to empty → `block`; if the acting multisig revokes its own ADMIN → `warn`.
  - `checkRoleSeparation(recipe): GuardrailResult` — refuse (`block`) granting `DOM_PAUSER`/`BLK_MANAGER` to the admin (acting) multisig; `warn` on existing collisions.
  - `checkRevokeInFlight(recipe, inflight: Proposal[]): GuardrailResult` — `warn` when a queued revoke could invalidate an in-flight proposal signed by the soon-revoked holder.
  - `runGuardrails(...)` — composes all three; the UI blocks submission on any `block` and requires an explicit confirm on any `warn`.

- [ ] **Step 1: Write the failing test** `tests/admin/guardrails.test.ts` — with a faucet fixture holding exactly one ADMIN, assert `checkLastAdmin` returns `level:'block'` for a revoke of that ADMIN, and `level:'ok'` when two ADMINs exist; assert `checkRoleSeparation` blocks `rbac_grant DOM_PAUSER` to the acting multisig.

- [ ] **Step 2: Run it, verify it fails** — `npm run test:admin -- guardrails` → FAIL.

- [ ] **Step 3: Implement** `src/lib/admin/guardrails.ts`.

- [ ] **Step 4: Run tests, verify pass** — `npm run test:admin -- guardrails` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(admin): RBAC frontend guardrails"`.

---

### Task 8: Custom proposal creation path

**Files:**
- Create: `src/lib/admin/adminRequest.ts`
- Modify: `src/contexts/MultisigContext.tsx` (add `handleCreateAdminProposal` + expose it on the context value/type)
- Test: `tests/admin/adminRequest.test.ts`

**Interfaces:**
- Consumes: Task 5 `buildAdminNoteBytes`; Task 4 recipe/label; OZ `multisigRequestBuilder`, `buildMultisigRequest`, `requestSaltHex`, `requestBoundBlockNum` (from `@openzeppelin/miden-multisig-client/dist/transaction/authArgs`); `Note`, `NoteArray` from `@miden-sdk/miden-sdk`.
- Produces:
  - `buildAdminTransactionRequest(client, recipe): Promise<{ request: TransactionRequest; recipe: AdminRecipe }>` — mirrors `buildP2idTransactionRequest`: `const { builder, saltHex } = await multisigRequestBuilder(client, { accountId: recipe.senderAccountId, salt: recipe.saltHex ? Word.fromHex(recipe.saltHex) : undefined, boundBlockNum: recipe.boundBlockNum || undefined })`; set the serial from `saltHex`; `Note.deserialize(buildAdminNoteBytes({...recipe, saltHex}))`; `builder.withOwnOutputNotes(new NoteArray([note]))`; `buildMultisigRequest(txBuilder, saltHex, recipe.senderAccountId)`. Return a recipe backfilled with the actual `saltHex` and `boundBlockNum` (read via `requestSaltHex`/`requestBoundBlockNum`).
  - Context: `handleCreateAdminProposal(recipe: Omit<AdminRecipe,'saltHex'|'boundBlockNum'> & Partial<...>): Promise<void>` — funnels through `runProposalCreation("USDCx " + action, async (ms) => { const { request, recipe: full } = await buildAdminTransactionRequest(midenClient, recipe); const proposal = await ms.createCustomProposal(request.serialize(), encodeRecipeLabel(full), {}); saveRecipe(proposal.id, { ...full, noteIdHex: <derived> }); })`.

- [ ] **Step 1: Write the failing test** `tests/admin/adminRequest.test.ts` — unit-test the recipe→label flow and the createCustomProposal wiring with a mocked `Multisig` (`createCustomProposal` returns `{ id: 'p1', ... }`), asserting: `createCustomProposal` is called with `(bytes: Uint8Array, label: string starting 'usdcx.v1.', {})`, and `saveRecipe('p1', ...)` persisted a recipe whose `decodeRecipeLabel` equals the label's recipe. Mock `buildAdminTransactionRequest` to return fixed bytes (full request building is covered by e2e, Task 14). Use dependency injection: `handleCreateAdminProposal` takes the builder via a module boundary that the test can stub, or test the inner `createAdminProposalWith(ms, buildFn, recipe)` helper directly.

- [ ] **Step 2: Run it, verify it fails** — `npm run test:admin -- adminRequest` → FAIL.

- [ ] **Step 3: Implement** `adminRequest.ts` and wire `handleCreateAdminProposal` into `MultisigContext` following `handleCreateP2idProposal` (`MultisigContext.tsx:1202`) and `runProposalCreation` (`:1120`). Add the method to `MultisigContextValue` (`:120`) and the assembled value (`:1565`).

- [ ] **Step 4: Run tests, verify pass** — `npm run test:admin -- adminRequest` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(admin): custom proposal creation path"`.

---

### Task 9: Custom execution path

**Files:**
- Modify: `src/contexts/MultisigContext.tsx` (branch `handleExecuteProposal`, or add `executeCustom` used by it)
- Test: `tests/admin/executeCustom.test.ts`

**Interfaces:**
- Consumes: Task 8 `buildAdminTransactionRequest`; Task 4 `loadRecipe`/`decodeRecipeLabel`; OZ `prepareCustomExecution(proposalId, bytes)→AdviceMap`, `submitTransaction(proposalId, request)`.
- Produces: an `executeCustomProposal(ms, client, proposal): Promise<void>` helper that: resolves the recipe (`loadRecipe(proposal.id)` ?? `decodeRecipeLabel(proposal.metadata.rawProposalType)`); rebuilds `{ request } = buildAdminTransactionRequest(client, recipe)`; `const advice = await ms.prepareCustomExecution(proposal.id, request.serialize())`; `const finalReq = request.toBuilder?.()`... — follow the SDK doc: fold advice via `builder.extendAdviceMap(advice).build()`. Since `buildAdminTransactionRequest` returns a `TransactionRequest`, rebuild through the builder: capture the `TransactionRequestBuilder` before `.build()` in `buildAdminTransactionRequest` and expose a variant `buildAdminTransactionRequestBuilder(...)` returning the builder so advice can be folded in; then `await ms.submitTransaction(proposal.id, builder.extendAdviceMap(advice).build())`.
- `handleExecuteProposal` gains a branch: `if (fresh.metadata.proposalType === 'custom') return executeCustomProposal(ms, midenClient, fresh);` placed inside the existing sync/lock scaffold (`MultisigContext.tsx:1369`), reusing the surrounding `accountOpInFlight` lock, `midenClient.sync()`, and `refreshAccount` on success. Built-ins keep calling `multisig.executeProposal`.

- [ ] **Step 1: Write the failing test** `tests/admin/executeCustom.test.ts` — with a mocked `Multisig` (`prepareCustomExecution` returns a stub AdviceMap, `submitTransaction` a spy) and a stubbed `buildAdminTransactionRequestBuilder` returning a builder whose `.extendAdviceMap().build()` yields a sentinel request: assert the custom path calls `prepareCustomExecution(id, bytes)` then `submitTransaction(id, sentinelRequest)`, and that a `p2id` proposal instead calls `executeProposal`.

- [ ] **Step 2: Run it, verify it fails** — `npm run test:admin -- executeCustom` → FAIL.

- [ ] **Step 3: Implement** the branch + `executeCustomProposal` helper + `buildAdminTransactionRequestBuilder` (refactor Task 8's builder to expose the pre-`.build()` builder; `buildAdminTransactionRequest` calls it then `.build()`).

- [ ] **Step 4: Run tests, verify pass** — `npm run test:admin -- executeCustom` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(admin): custom proposal execution path"`.

---

### Task 10: `ProposalDetails` custom renderer

**Files:**
- Create: `src/lib/admin/describe.ts`
- Modify: `src/components/ProposalDetails.tsx` (add `case 'custom'` before `default`, `:77`–`:78`)
- Test: `tests/admin/describe.test.ts`

**Interfaces:**
- Consumes: `AdminRecipe`, `decodeRecipeLabel`.
- Produces: `describeAdminRecipe(recipe: AdminRecipe): { title: string; lines: string[] }` — e.g. `set_max_supply` → `{ title: 'Set max supply', lines: ['New max supply: 1000'] }`; `rbac_grant` → `{ title: 'Grant role', lines: ['Role: BLK_MANAGER', 'Target: 0x…'] }`; `pause` → `{ title: 'Pause USDCx', lines: [] }`. Amounts formatted via `formatTokenAmount` + `useFaucetDecimals` where a token amount (deferred to the component; `describe.ts` emits raw units and the action semantics).

- [ ] **Step 1: Write the failing test** `tests/admin/describe.test.ts` — assert the title + lines for all 8 actions (and that an unknown `rawProposalType` decodes to `null` so the component falls through to the existing generic default).

- [ ] **Step 2: Run it, verify it fails** — `npm run test:admin -- describe` → FAIL.

- [ ] **Step 3: Implement** `describe.ts`; then in `ProposalDetails.tsx` add:

```tsx
case 'custom': {
  const recipe = decodeRecipeLabel((md as CustomProposalMetadata).rawProposalType);
  if (!recipe) break; // fall to default
  const d = describeAdminRecipe(recipe);
  return (<div>{/* title + lines, reuse existing detail markup */}</div>);
}
```

(`break` falls to the existing `default` at `:78`.) Import `CustomProposalMetadata` type from `@openzeppelin/miden-multisig-client`.

- [ ] **Step 4: Run tests, verify pass** — `npm run test:admin -- describe` → PASS; `npm run test:roundtrip && npm run test:ledger` still green.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(admin): ProposalDetails custom renderer"`.

---

### Task 11: Consumption-state poller

**Files:**
- Create: `src/lib/admin/consumption.ts`, `src/hooks/useAdminNoteConsumption.ts`
- Test: `tests/admin/consumption.test.ts`

**Interfaces:**
- Consumes: `getOutputNotesFromTxSummary` (`multisigApi.ts:141`), `Note.id()`, `client.notes.list({ids})` / `InputNoteRecord.isConsumed()`, `AdminRecipe.noteIdHex`.
- Produces:
  - `type ConsumptionState = 'created' | 'collecting' | 'threshold_reached' | 'executed' | 'awaiting_consumption' | 'applied' | 'failed'`.
  - `deriveStateFromProposal(proposal: Proposal): ConsumptionState` — maps proposal status/signatures to `created|collecting|threshold_reached|executed` (`executed` = `status==='finalized'`).
  - `resolveAdminNoteId(proposal, recipe): string` — prefer `recipe.noteIdHex`; else rebuild the note from the recipe serial and take `note.id().toString()`; never read `outputNotes()[0]` (fee note).
  - `useAdminNoteConsumption(proposal, recipe): ConsumptionState` — once `executed`, polls `client.notes.list({ ids: [noteId] })` (and `RpcClient.getNotesById` as a direct-node fallback) on an interval until the record `isConsumed()` → `applied`; surfaces `failed` on a terminal node error. **Never returns `applied` from proposal finalization alone.**

- [ ] **Step 1: Write the failing test** `tests/admin/consumption.test.ts` — unit-test `deriveStateFromProposal` for each proposal status, and `resolveAdminNoteId` (given a recipe with `noteIdHex`, returns it; without, rebuilds — stub the note builder). Assert the fee note is never selected (feed an `outputNotes` list where `[0]` is the fee note and the admin note is `[1]`; `resolveAdminNoteId` must return the recipe-derived id, independent of array order).

- [ ] **Step 2: Run it, verify it fails** — `npm run test:admin -- consumption` → FAIL.

- [ ] **Step 3: Implement** `consumption.ts` + `useAdminNoteConsumption.ts` (poller with cleanup on unmount; backoff; stop on `applied`/`failed`).

- [ ] **Step 4: Run tests, verify pass** — `npm run test:admin -- consumption` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(admin): consumption-state poller"`.

---

### Task 12: Admin mask UI (forms + role gating + banner)

**Files:**
- Create: `src/app/dashboard/admin/page.tsx`, `src/app/dashboard/admin/components/*` (one form per action group), `src/components/admin/AdminBanner.tsx`
- Test: covered by e2e (Task 14); logic already unit-tested in Tasks 3–11.

**Interfaces:**
- Consumes: `useFaucetRoles`, `ACTION_ROLE`, the validators, `handleCreateAdminProposal`, `runGuardrails`, `describeAdminRecipe`, `useAdminNoteConsumption`, `AdminBanner`.

- [ ] **Step 1: Build `AdminBanner.tsx`** — a persistent prominent banner showing `networkId`, the USDCx `faucetId` (short form via `shortFaucetId`), the loaded acting multisig id, and the detected roles (from `useFaucetRoles`); render a distinct `error` treatment when `RolesState.status==='error'`.

- [ ] **Step 2: Build the mask `page.tsx`** — renders `AdminBanner` + an action list filtered by `useFaucetRoles` (`ACTION_ROLE[action]` must be held). While `status==='loading'` show a spinner; `status==='error'` show the error (never an empty "no actions"); `status==='ready'` show only permitted actions.

- [ ] **Step 3: Build the forms** (grouped): supply/burn/fee (ADMIN u64 + Word inputs), rbac grant/revoke (role select + account id), set_attester (Word + enabled), pause/unpause (confirm-only), blocklist (account id + block/unblock). Each: validate via Task 3, run `runGuardrails` (block disables submit; warn requires a typed confirm), then `handleCreateAdminProposal`. For `set_note_fee`, render `fee_faucet` as a **read-only** field = `getAdminConfig().feeFaucetId`.

- [ ] **Step 4: Wire the review-before-create** — before calling `handleCreateAdminProposal`, show the `describeAdminRecipe` summary in a confirm step (the same decode every co-signer sees via `ProposalDetails`).

- [ ] **Step 5: Manual smoke** — `NEXT_PUBLIC_APP_MODE=admin NEXT_PUBLIC_USDCX_FAUCET_ID=0x… npm run dev`; confirm the mask renders, gating reflects roles, forms validate. (Full create→execute is the Task 14 devnet e2e.)

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(admin): role-gated admin mask UI + banner"`.

---

### Task 13: Admin-mode routing & packaging gating

**Files:**
- Modify: `src/app/dashboard/home/page.tsx`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/components/Sidebar.tsx`, `src/middleware.ts`
- Test: `tests/admin/routing.test.ts` (pure gating logic extracted to a testable fn)

**Interfaces:**
- Produces: `adminRouteGuard(pathname: string): { redirectTo: string } | null` in a small pure module `src/lib/admin/routeGuard.ts` (so middleware logic is node-testable). In admin mode, end-user-only routes (`/dashboard/assets`, the Send/Receive modals) redirect to `/dashboard/admin`; in wallet mode it returns `null` for all.

- [ ] **Step 1: Write the failing test** `tests/admin/routing.test.ts` — `adminRouteGuard('/dashboard/assets')` → `{redirectTo:'/dashboard/admin'}` when admin; `null` when wallet; `/dashboard/admin` itself never redirects.

- [ ] **Step 2: Run it, verify it fails** — `npm run test:admin -- routing` → FAIL.

- [ ] **Step 3: Implement** `routeGuard.ts`; call it from `middleware.ts` (after the existing auth checks, `:38`). In admin mode: redirect `/dashboard` and `/dashboard/home` → `/dashboard/admin`.

- [ ] **Step 4: Gate the shell** — in `dashboard/layout.tsx`, do not mount `SendModal`/`ReceiveModal` when `isAdminMode`; in `Sidebar.tsx` (`sidebarPages`, `:10`) swap the nav for admin mode (Admin + Transactions + Settings; drop Home/Assets/Send/Receive); in `home/page.tsx` render a redirect to `/dashboard/admin` under `isAdminMode` (defense in depth with middleware).

- [ ] **Step 5: Run** `npm run test:admin -- routing` → PASS; `npm run build` (wallet mode, default) succeeds.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(admin): admin-mode routing + packaging gating"`.

---

### Task 14: CI both-builds, Vercel config, devnet e2e runbook

**Files:**
- Modify: `.github/workflows/test.yml`
- Create: `vercel.json`, `docs/DEPLOY_VERCEL.md`

**Interfaces:** none (infra/docs).

- [ ] **Step 1: Add both-build compile checks** to the frontend CI job: one `npm run build` (default wallet) and one with `NEXT_PUBLIC_APP_MODE=admin NEXT_PUBLIC_USDCX_FAUCET_ID=0x0 NEXT_PUBLIC_USDCX_FEE_FAUCET_ID=0x0 npm run build`. Add `npm run test:admin` to the job (alongside the existing `test:roundtrip`/`test:ledger`).

- [ ] **Step 2: Verify locally first** (per CI-gate rule): run both builds + `test:admin` locally; only commit once green.

- [ ] **Step 3: Create `vercel.json`** for the monorepo (app in `bin/coordinator-frontend`):

```json
{ "buildCommand": "npm run build", "framework": "nextjs", "installCommand": "npm ci" }
```

Document that the Vercel project's **Root Directory** must be `bin/coordinator-frontend`, and that `output: 'standalone'` is ignored by Vercel (its builder supplies its own output).

- [ ] **Step 4: Write `docs/DEPLOY_VERCEL.md`** — the admin deploy's required env vars (`NEXT_PUBLIC_APP_MODE=admin`, `NEXT_PUBLIC_USDCX_FAUCET_ID`, `NEXT_PUBLIC_USDCX_FEE_FAUCET_ID`, `NEXT_PUBLIC_GUARDIAN_ENDPOINT=https://guardian-devnet.openzeppelin.com`, `NEXT_PUBLIC_MIDEN_RPC_URL`, `NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL`, `NEXT_PUBLIC_MIDEN_NETWORK=devnet`, Para vars, and any `NEXT_PUBLIC_CSP_CONNECT_SRC` additions for the Guardian/RPC origins). Note the 0.17 operational window: a custom admin proposal binds a block; execute within the pruning/expiry window (~20–50 blocks) or re-create (surface the on-chain expiry/pruning error via `describeExecutionError`).

- [ ] **Step 5: Document the per-note devnet e2e checklist** in `docs/DEPLOY_VERCEL.md`: for each note — create→sign→execute→faucet consumes with the consumption poller reaching `applied`; pause via a 1-of-N `DOM_PAUSER` multisig; unpause via an `DOM_UNPAUSER` majority; an unauthorized-role attempt is gated; wrong-network account input rejected; browser-reload reconstruction; second-signer reconstruction.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "ci+docs(admin): both-build gate, Vercel config, devnet e2e runbook"`.

---

## Open decisions / rulings carried into execution

1. **`rbac_role_members` added to the crate (Task 2).** The spec's mandatory last-ADMIN guardrail needs the ADMIN member set, which the shipped WASM cannot produce. This is an additive, in-scope extension of the Plan 1 crate. If scanning the RBAC storage map proves infeasible in the crate's 0.17 API, fall back: gate ADMIN-revoke behind a typed-confirmation dialog that states the count could not be verified — and record the ruling.
2. **Recipe transport via the `rawProposalType` label.** Chosen because the SDK exposes no other signer-visible free field on a custom proposal and preserves `rawProposalType` across Guardian round-trips. If a Guardian label-length limit is hit at runtime, fall back to storing the recipe in `BaseProposalMetadata.description` via the lower-level `createProposal(nonce, txSummaryBase64, metadata)`.
3. **Bound-block / expiry is an operational window, not a plan defect.** Determinism fixes `boundBlockNum`; execution must happen within the 0.17 pruning/expiry window or the proposal is re-created. Surfaced in the banner + error toasts, not engineered around.
4. **Full request-byte determinism is e2e-verified, not unit-verified** — building a real `TransactionRequest` needs a live client + account; unit tests cover the deterministic serial + recipe/label codec, and the devnet e2e (Task 14) proves byte-identical cross-signer reconstruction.

## Self-Review

**Spec coverage:** architecture/packaging → T1,T13; role model → T6; 8 note builders → T5; RBAC safety (on-chain vs frontend) → T7 (+T2 enabling data); deterministic reconstruction → T4,T8,T9; review-before-create → T10,T12; creation-vs-consumption states → T11; input validation → T3; role gating as convenience → T6,T12; route+environment safety → T12 (banner),T13; reuse list → honored throughout (T8/T9 reuse `runProposalCreation`/execute scaffold, T10 reuses `ProposalDetails`); testing matrix → T3–T11 node tests + T14 e2e; SDK integration rules → Global Constraints. `fee_sponsorship` excluded. No gap found.

**Placeholder scan:** no "TBD"/"handle errors"/"similar to"; each code step carries real code or an exact signature + file:line. Where full-request determinism can't be unit-tested, that's stated explicitly (ruling 4), not hidden behind a vague step.

**Type consistency:** `AdminRecipe`/`AdminAction`/`AdminActionArgs` defined in T4 and consumed unchanged in T5/T8/T9/T10/T11; `Role`/`ACTION_ROLE` defined T6, consumed T7/T12; `buildAdminTransactionRequestBuilder` introduced T9 as the refactor of T8's builder (noted in both). WASM `rbac_role_members` signature identical in T2 (producer) and T6/T7 (consumers).
