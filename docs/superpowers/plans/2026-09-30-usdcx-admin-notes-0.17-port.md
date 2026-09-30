# USDCx Admin Notes 0.17 Port — Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `usdcx-admin-notes` builder crate + its wasm bindings from miden 0.16.1 to 0.17 (built on upstream `xusdc-encoding`), producing note bytes that deserialize under `@miden-sdk` 0.17 and are consumable by the deployed 0.17 USDCx faucet. Foundation for the frontend admin console (Plan 2).

**Architecture:** The crate exposes 8 admin-note builders + `account_has_role`. Five wrap miden-standards 0.17 config-notes (`FaucetMetadataConfigNote`, `ConstantFeePolicyConfigNote`, `RbacConfigNote`, `PauseConfigNote`, `BlocklistConfigNote`); two (`set_min_burn`, `set_attester`) reuse upstream `xusdc-encoding` 0.17 (`XReserveMinBurnAmountNote`, `XReserveSetAttesterNote`). `fee_sponsorship` is dropped for v1. wasm-bindgen exposes bytes-only builders.

**Tech Stack:** Rust, miden-protocol/standards/tx 0.17.0-rc.7, `xusdc-encoding` (from `0xMiden/miden-usdcx` `e68f8bc`), wasm-pack (`--target web`), `@miden-sdk/miden-sdk` 0.17.0-rc.4 (JS round-trip test).

**Spec:** `docs/superpowers/specs/2026-09-30-usdcx-admin-console-design.md` (commit `4ea0ec0`).

## Global Constraints
- **Base branch:** fresh off `origin/main` `7f0f82e`. Recover the preserved 0.16 crate from `preserve/usdcx-admin-0.16` as the porting source.
- **Miden version:** all miden crates pinned `=0.17.0-rc.7` (protocol/standards/tx); match `xusdc-encoding`'s pins exactly. No 0.16.x anywhere.
- **Roles (verified, fixed in faucet):** `DOM_PAUSER`→pause, `DOM_UNPAUSER`→unpause, `ATTEST_ADMIN`→set_attester, `BLK_MANAGER`→block/unblock, else `ADMIN`.
- **v1 note set = 8** (no `fee_sponsorship`).
- **Interop is bytes-only:** each builder returns serialized `Note` bytes; `Word`/`NoteId`/`NoteScriptRoot`/`Account` cross as serialized bytes, account ids as hex — matching `@miden-sdk` 0.17 serialization.
- **Prefer `xusdc-encoding` / miden-standards note types over hand-rolled encoders.**
- TDD; commit per task; `cargo test -p usdcx-admin-notes` green before each commit.

---

## File structure
- `crates/usdcx-admin-notes/Cargo.toml` — deps bumped to 0.17 + `xusdc-encoding`.
- `crates/usdcx-admin-notes/src/lib.rs` — roles, `account_has_role`, 8 builders (ported).
- `crates/usdcx-admin-notes/src/wasm.rs` — wasm-bindgen bytes API (8 builders + role check; no `fee_sponsorship`).
- `crates/usdcx-admin-notes/tests/builders.rs` — per-builder unit tests + `account_has_role`.
- `crates/usdcx-admin-notes/tests/roundtrip_0_17.rs` — MockChain: build → execute against a 0.17 faucet fixture.
- `bin/coordinator-frontend/tests/roundtrip/deserialize.test.ts` — JS: wasm note bytes → `@miden-sdk` 0.17 `Note.deserialize`.
- `bin/coordinator-frontend/src/lib/usdcxAdminWasm/` — re-vendored 0.17 wasm.

---

### Task 1: Base branch + 0.17 crate scaffold (compiles, no builders yet)

**Files:**
- Create: fresh branch `usdcx-admin-console-impl` off `origin/main` `7f0f82e`.
- Create/Modify: `crates/usdcx-admin-notes/Cargo.toml`, workspace `Cargo.toml` members.

**Interfaces:**
- Produces: a workspace that compiles with `usdcx-admin-notes` present, miden pinned `=0.17.0-rc.7`, `xusdc-encoding` as a git dep on `0xMiden/miden-usdcx` `e68f8bc`.

- [ ] **Step 1:** Create the branch and recover the crate source:
```bash
git fetch origin && git checkout -b usdcx-admin-console-impl 7f0f82e
git checkout preserve/usdcx-admin-0.16 -- crates/usdcx-admin-notes
```
- [ ] **Step 2:** Rewrite `crates/usdcx-admin-notes/Cargo.toml` deps to 0.17 and add `xusdc-encoding`:
```toml
[dependencies]
miden-protocol  = { version = "=0.17.0-rc.7", default-features = false, features = ["std"] }
miden-standards = { version = "=0.17.0-rc.7", default-features = false, features = ["std"] }
miden-tx        = { version = "=0.17.0-rc.7", default-features = false, features = ["std"] }
xusdc-encoding  = { git = "https://github.com/0xMiden/miden-usdcx", rev = "e68f8bc" }
thiserror = { version = "2", default-features = false }
wasm-bindgen = { version = "0.2", optional = true }
getrandom = { version = "0.2", features = ["js"], optional = true }
[features]
wasm = ["dep:wasm-bindgen", "dep:getrandom"]
```
- [ ] **Step 3:** Add the crate to workspace `Cargo.toml` `members` if not already present.
- [ ] **Step 4:** Temporarily comment out `fee_sponsorship` (removed in Task 8) and any items that don't yet compile, so the crate builds. Run: `cargo build -p usdcx-admin-notes`. Expected: compiles (with warnings for unused).
- [ ] **Step 5:** Commit: `git add crates/usdcx-admin-notes Cargo.toml && git commit -m "chore(usdcx-admin-notes): scaffold 0.17 crate on origin/main base"`

---

### Task 2: `account_has_role` + role symbols (0.17)

**Files:** Modify `src/lib.rs`; Test `tests/builders.rs`.

**Interfaces:**
- Produces: `pub const ATTEST_ADMIN_ROLE/DOM_PAUSER_ROLE/DOM_UNPAUSER_ROLE/BLK_MANAGER_ROLE: &str`; `pub fn admin_role() -> RoleSymbol`; `pub fn role_symbol(&str) -> Result<RoleSymbol, AdminNoteError>`; `pub fn account_has_role(faucet: &Account, account: AccountId, role: &RoleSymbol) -> bool`.

- [ ] **Step 1: failing test** in `tests/builders.rs`:
```rust
#[test]
fn account_has_role_true_when_member() {
    // Build a faucet Account with ADMIN granted to `holder` via the 0.17 RBAC map,
    // then assert account_has_role(&faucet, holder, &admin_role()) is true and a
    // non-member is false. (Use xusdc-encoding's XReserveStablecoinBuilder test
    // helper to construct the faucet with an ADMIN member.)
    let (faucet, holder, other) = usdcx_admin_notes::testing::faucet_with_admin();
    assert!(usdcx_admin_notes::account_has_role(&faucet, holder, &usdcx_admin_notes::admin_role()));
    assert!(!usdcx_admin_notes::account_has_role(&faucet, other, &usdcx_admin_notes::admin_role()));
}
```
- [ ] **Step 2:** `cargo test -p usdcx-admin-notes account_has_role_true_when_member` → FAIL (helper/symbols missing).
- [ ] **Step 3:** Port the role constants + `admin_role`/`role_symbol`/`account_has_role` from the preserved 0.16 `lib.rs` (bodies are unchanged shape; verify `RoleBasedAccessControl::role_membership_slot()`, `RoleSymbol::as_element()`, `StorageMapKey::new`, `AccountId::{prefix,suffix}` against miden-standards 0.17 — adjust any renamed method). Add a `testing` module with `faucet_with_admin()` using `xusdc-encoding`'s `XReserveStablecoinBuilder`.
- [ ] **Step 4:** `cargo test -p usdcx-admin-notes account_has_role_true_when_member` → PASS.
- [ ] **Step 5:** Commit: `git commit -am "feat(usdcx-admin-notes): port account_has_role + role symbols to 0.17"`

---

### Task 3: The five miden-standards config-note builders (set_max_supply, set_note_fee, rbac, pause, blocklist)

**Files:** Modify `src/lib.rs`; Test `tests/builders.rs`.

**Interfaces (ported verbatim from 0.16, retargeted to 0.17 note types):**
- `pub fn set_max_supply(faucet, sender, max_supply: u64, serial: Word) -> Result<Note, AdminNoteError>` → `FaucetMetadataConfigNote::builder()…config(FaucetMetadataConfig::SetMaxSupply{max_supply})`.
- `pub fn set_note_fee(faucet, sender, note_script_root: NoteScriptRoot, fee_asset: FungibleAsset, serial) -> …` → `ConstantFeePolicyConfigNote::builder()`.
- `pub fn rbac(faucet, sender, config: RbacConfig, serial) -> …` → `RbacConfigNote::builder()`.
- `pub fn pause(faucet, sender, unpause: bool, serial) -> …` → `PauseConfigNote::builder()` with `PauseConfig::{Pause,Unpause}`.
- `pub fn blocklist(faucet, sender, account, unblock: bool, serial) -> …` → `BlocklistConfigNote::builder()` with `BlocklistConfig::{BlockAccount,UnblockAccount}{account}`.

- [ ] **Step 1: failing tests** — one per builder in `tests/builders.rs`, e.g.:
```rust
#[test]
fn set_max_supply_builds_targeting_faucet() {
    let (faucet, sender) = usdcx_admin_notes::testing::faucet_and_sender();
    let note = usdcx_admin_notes::set_max_supply(faucet, sender, 1_000_000, Word::from([1u32,2,3,4])).unwrap();
    assert_eq!(note.metadata().sender(), sender);
    // round-trips through serialization
    let bytes = note.to_bytes();
    assert_eq!(Note::read_from_bytes(&bytes).unwrap(), note);
}
```
(Repeat for `set_note_fee`, `rbac` grant+revoke, `pause`+`unpause`, `blocklist` block+unblock — assert build succeeds, sender/target correct, and serialize→deserialize is identity.)
- [ ] **Step 2:** `cargo test -p usdcx-admin-notes` → the 5-builder tests FAIL.
- [ ] **Step 3:** Port the 5 builder bodies from preserved 0.16 `lib.rs` (they are near-1:1). Fix any 0.17 API drift in `FaucetMetadataConfig`/`ConstantFeePolicyConfigNote`/`RbacConfig`/`PauseConfig`/`BlocklistConfig` (check exact enum variants + builder method names in miden-standards 0.17). Add `testing::faucet_and_sender()`.
- [ ] **Step 4:** `cargo test -p usdcx-admin-notes` → the 5-builder tests PASS.
- [ ] **Step 5:** Commit: `git commit -am "feat(usdcx-admin-notes): port 5 standards config-note builders to 0.17"`

---

### Task 4: The two faucet-owned builders (set_min_burn, set_attester) on `xusdc-encoding` 0.17

**Files:** Modify `src/lib.rs`; Test `tests/builders.rs`.

**Interfaces:**
- `pub fn set_min_burn(faucet, sender, min_burn: u64, serial: Word) -> …` → `xusdc_encoding::note::XReserveMinBurnAmountNote` (`min_burn_amount.rs`), serial via `RandomCoin::new(serial)`. Enforce floor ≥1 (map error → `AdminNoteError::MinBurnBelowFloor`).
- `pub fn set_attester(faucet, sender, commitment: Word, enabled: bool, serial: Word) -> …` → `xusdc_encoding::note::XReserveSetAttesterNote::create(sender, faucet, commitment, u8::from(enabled), &mut RandomCoin::new(serial))`.

- [ ] **Step 1: failing tests:**
```rust
#[test]
fn set_min_burn_rejects_zero() {
    let (faucet, sender) = usdcx_admin_notes::testing::faucet_and_sender();
    assert!(usdcx_admin_notes::set_min_burn(faucet, sender, 0, Word::from([9u32,9,9,9])).is_err());
    assert!(usdcx_admin_notes::set_min_burn(faucet, sender, 1, Word::from([9u32,9,9,9])).is_ok());
}
#[test]
fn set_attester_enabled_flag_encodes() {
    let (faucet, sender) = usdcx_admin_notes::testing::faucet_and_sender();
    let note = usdcx_admin_notes::set_attester(faucet, sender, Word::from([7u32;4]), true, Word::from([1u32,1,1,1])).unwrap();
    assert_eq!(Note::read_from_bytes(&note.to_bytes()).unwrap(), note);
}
```
- [ ] **Step 2:** `cargo test -p usdcx-admin-notes` → these FAIL.
- [ ] **Step 3:** Port both builders using the `xusdc-encoding` 0.17 note types (confirm `XReserveMinBurnAmountNote::new`/builder signature and `XReserveSetAttesterNote::create` args in `crates/xusdc-encoding/src/note/xreserve_admin/`). Keep the `seeded_rng`/`RandomCoin::new(serial)` determinism.
- [ ] **Step 4:** `cargo test -p usdcx-admin-notes` → PASS.
- [ ] **Step 5:** Commit: `git commit -am "feat(usdcx-admin-notes): port set_min_burn + set_attester on xusdc-encoding 0.17"`

---

### Task 5: Remove `fee_sponsorship`; finalize error enum

**Files:** Modify `src/lib.rs`.

- [ ] **Step 1:** Delete the `fee_sponsorship` fn and its `AdminNoteError` variant / `FeeSponsorshipNote` import. Remove any doc references.
- [ ] **Step 2:** `cargo build -p usdcx-admin-notes` → compiles, no unused-import warnings.
- [ ] **Step 3:** `cargo test -p usdcx-admin-notes` → all green.
- [ ] **Step 4:** Commit: `git commit -am "feat(usdcx-admin-notes): drop fee_sponsorship for v1 (8-note set)"`

---

### Task 6: wasm-bindgen bytes API (8 builders + role check)

**Files:** Modify `src/wasm.rs`; build config.

**Interfaces (JS-facing, bytes-only):** `account_has_role(faucet_account:&[u8], account_hex:&str, role:&str)->bool`; `build_set_max_supply`, `build_set_note_fee`, `build_rbac_grant`, `build_rbac_revoke`, `build_pause`, `build_blocklist`, `build_set_min_burn`, `build_set_attester` — each `-> Result<Vec<u8>, JsError>` returning serialized `Note` bytes. **No `build_fee_sponsorship`.**

- [ ] **Step 1:** Port `wasm.rs` from preserved 0.16 (the shape is unchanged), delete `build_fee_sponsorship`, update the header comment to say 0.17 serialization. Verify `Word::read_from_bytes`, `NoteId::read_from_bytes`, `NoteScriptRoot::read_from_bytes`, `Account::read_from_bytes`, `AccountId::from_hex` against 0.17.
- [ ] **Step 2:** `cargo build -p usdcx-admin-notes --features wasm` → compiles.
- [ ] **Step 3:** `wasm-pack build crates/usdcx-admin-notes --target web --features wasm --out-dir pkg` → succeeds; produces `pkg/usdcx_admin_notes{.js,_bg.wasm,.d.ts}`.
- [ ] **Step 4:** Re-vendor into the frontend: `rm -rf bin/coordinator-frontend/src/lib/usdcxAdminWasm && cp -r crates/usdcx-admin-notes/pkg bin/coordinator-frontend/src/lib/usdcxAdminWasm`.
- [ ] **Step 5:** Commit: `git add crates/usdcx-admin-notes/src/wasm.rs bin/coordinator-frontend/src/lib/usdcxAdminWasm && git commit -m "feat(usdcx-admin-notes): 0.17 wasm bindings (8 builders), re-vendor"`

---

### Task 7: Round-trip guard — Rust MockChain execute against a 0.17 faucet

**Files:** Create `crates/usdcx-admin-notes/tests/roundtrip_0_17.rs`.

- [ ] **Step 1: failing test:** build a 0.17 USDCx faucet (via `xusdc-encoding` `XReserveStablecoinBuilder`) with the acting account granted `ADMIN`; build a `set_max_supply` note; execute a MockChain tx consuming it at the faucet; assert it succeeds and `token supply`/max-supply config changed. Similarly assert a `pause` note by a `DOM_PAUSER`-holder pauses, and by a non-holder fails.
```rust
#[test]
fn set_max_supply_note_consumes_on_0_17_faucet() {
    let mut chain = usdcx_admin_notes::testing::mock_chain_with_faucet_admin();
    let note = usdcx_admin_notes::set_max_supply(chain.faucet_id(), chain.admin_id(), 5_000_000, Word::from([2u32,2,2,2])).unwrap();
    let res = chain.consume_at_faucet(note);
    assert!(res.is_ok(), "0.17 faucet must consume the note: {res:?}");
}
```
- [ ] **Step 2:** `cargo test -p usdcx-admin-notes --test roundtrip_0_17` → FAIL.
- [ ] **Step 3:** Implement the `testing` MockChain helpers (mirror `xusdc-encoding`/miden-testing patterns) + the note-consumption assertion.
- [ ] **Step 4:** `cargo test -p usdcx-admin-notes --test roundtrip_0_17` → PASS (proves the notes are consumable by the 0.17 faucet).
- [ ] **Step 5:** Commit: `git commit -am "test(usdcx-admin-notes): 0.17 faucet consumption round-trip"`

---

### Task 8: Round-trip guard — JS `@miden-sdk` 0.17 deserialize

**Files:** Create `bin/coordinator-frontend/tests/roundtrip/deserialize.test.ts` (vitest).

- [ ] **Step 1: failing test:** import the re-vendored `usdcxAdminWasm`, build each of the 8 notes' bytes with dummy-but-valid inputs, and assert `Note.deserialize(bytes)` from `@miden-sdk/miden-sdk` (0.17.0-rc.4) succeeds for every one.
```ts
import { Note } from "@miden-sdk/miden-sdk";
import init, { build_set_max_supply /* …8 */ } from "@/lib/usdcxAdminWasm/usdcx_admin_notes";
test("every admin note deserializes under @miden-sdk 0.17", async () => {
  await init();
  const bytes = build_set_max_supply(FAUCET_HEX, SENDER_HEX, 1000000n, SERIAL_BYTES);
  expect(() => Note.deserialize(bytes)).not.toThrow();
  // …repeat for the other 7 builders
});
```
- [ ] **Step 2:** `npm test -- deserialize` → FAIL (until wasm present/valid).
- [ ] **Step 3:** Wire the vitest config to load the wasm; fix any input-encoding mismatches surfaced.
- [ ] **Step 4:** `npm test -- deserialize` → PASS (proves version match with the FE SDK).
- [ ] **Step 5:** Commit: `git commit -am "test(frontend): admin-note wasm round-trips under @miden-sdk 0.17"`

---

## Self-review notes
- **Spec coverage:** §"Rust crate + wasm" (Tasks 1–6), §"Guard-rail test" (Tasks 7–8), Decision B exclude (Task 5), verified role model (Global Constraints + Task 2). Frontend items (mask, guardrails, states, packaging) are **Plan 2**.
- **Placeholder note:** where a 0.17 note-type builder's exact method name can't be pinned from the 0.16 body, the step says to confirm it against the named miden-standards/`xusdc-encoding` 0.17 file — this is verification, not a placeholder; the code shape is given.
- **Type consistency:** builder signatures in Tasks 3–4 match the wasm signatures in Task 6 and the spec's note table.
