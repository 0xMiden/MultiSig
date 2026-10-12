# AggLayer Bridge Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the one deployed admin console administer the AggLayer bridge (role management, pause/unpause) next to the USDCx faucet, choosing the console by the roles the connected account holds.

**Architecture:** An "admin target" profile (contract kind, id, roles, actions, labels) replaces the hard-coded USDCx faucet throughout `bin/coordinator-frontend/src/lib/admin`. A hook evaluates roles on every configured target and a context carries the active one; the existing action-card engine, roles page, banner and history annotation read from it. The Rust crate gains the two missing RBAC note builders and a paused-flag reader, proven on a MockChain bridge from the published `miden-agglayer` crate.

**Tech Stack:** Rust 2024 (`miden-protocol`/`miden-standards`/`miden-agglayer` `=0.17.1`, `miden-testing`, wasm-bindgen via `wasm-pack`), Next.js 15 / React 18 / TypeScript, vitest, `@miden-sdk/miden-sdk` 0.17.0, OpenZeppelin multisig client 0.18.0.

**Spec:** `docs/superpowers/specs/2026-10-08-agglayer-admin-console-design.md`

## Global Constraints

- Crate pins stay `=0.17.1` for `miden-protocol`, `miden-standards`, `miden-tx`, `miden-usdcx`, `miden-testing`; `miden-agglayer` is added at `=0.17.1` as a dev-only dependency (feature `testing`). Confirm against the deployed testnet bridge's version once it exists.
- USDCx behaviour is unchanged: five roles, nine actions, label prefix `usdcx_v1_`, existing proposals decode as before.
- AggLayer is enabled only when `NEXT_PUBLIC_AGGLAYER_BRIDGE_ID` is set; unset means no behaviour change.
- Vocabulary in UI copy: a **transaction** is on chain, a **proposal** is not yet committed; the bridge's root role is shown as `BRIDGE_ADMIN` (on-chain symbol `ADMIN`); FAUCET_ADMIN is not a bridge role.
- Deviation from the spec, decided while planning: the recipe keeps field name `faucetId` (meaning "target contract id") and `recipeVersion: 1`, and adds an optional `target` field (absent = `usdcx`). This avoids a v2 migration; old labels are byte-identical.
- All Rust commands run from the worktree root `/Users/domi2000/Repos/miden-multisig/wt-usdcx-impl`; all npm commands from `bin/coordinator-frontend`. Cargo builds into `~/.cargo/shared-target` on this machine.
- Commit per task; never amend; no `Co-Authored-By`; do not push unless asked.

## Review Focus

1. A bridge whose `ADMIN` role has exactly one holder, which is the acting multisig, and a `rbac_renounce` of `ADMIN`: must be **blocked** (would empty BRIDGE_ADMIN). Test in Task 7.
2. An `agg_v1_` label reaching a console build that has no bridge configured (env unset): must still decode and describe (proposal lists do not crash), but the action stays locked. Tests in Task 5 (decode) and Task 8 (selection with one target).
3. A role name typed with lowercase or spaces for the bridge (`"pauser"`): the wasm `role_symbol` rejects it; the form must reject before building. Test in Task 6 (`isRoleSymbol`).
4. Both targets configured but the node cannot serve one account (private or missing): the other console must still work and the failing one must show its error, never "no roles". Test in Task 8 (`selectActiveTarget` skips `error` evaluations).
5. A pause note sent by an account holding `PAUSER` on the bridge while the bridge is already paused: the chain accepts or rejects it, the console must show the current paused flag so the operator sees it. Test in Task 2 (`is_paused` reader after pause) and Task 9b (state card renders the flag).

---

## File structure

Rust crate `crates/usdcx-admin-notes` (name kept):
- Modify `src/lib.rs`: `is_paused` reader, `rbac_set_admin`, `rbac_renounce` builders.
- Modify `src/wasm.rs`: `is_paused`, `build_rbac_set_admin`, `build_rbac_renounce` exports.
- Modify `src/testing.rs`: `mock_chain_with_bridge_roles` fixture.
- Modify `Cargo.toml`: dev-dependency `miden-agglayer`.
- Create `tests/agglayer_roundtrip_0_17.rs`; modify `tests/builders.rs`, `tests/roles.rs`, `tests/allowlist.rs`.

Frontend `bin/coordinator-frontend/src`:
- Create `lib/admin/target.ts` (profiles, one responsibility: what a target is).
- Create `lib/admin/targetSelection.ts` (pure selection rule).
- Modify `config/adminConfig.ts` (bridge id, `getAdminTargets`).
- Modify `lib/admin/recipe.ts`, `noteBuilders.ts`, `describe.ts`, `roles.ts`, `guardrails.ts`, `directAction.ts`, `validation.ts`.
- Create `hooks/useAdminTargets.ts`, `contexts/AdminTargetContext.tsx`, `hooks/useBridgeState.ts`.
- Modify `hooks/useOnChainHistory.ts`, `lib/history/annotate.ts`.
- Modify `app/dashboard/admin/page.tsx`, `admin/roles/page.tsx`, `admin/components/{AdminActionCard,LockedActionCard,RbacForms,PauseForms}.tsx`, `components/admin/AdminBanner.tsx`, `app/dashboard/layout.tsx`, `contexts/MultisigContext.tsx` (one label string).
- Create `app/dashboard/admin/components/BridgeStateCard.tsx`, `components/admin/AdminTargetSwitcher.tsx`.
- Tests under `tests/admin/` and `tests/roundtrip/deserialize.test.ts`.

---

### Task 1: Crate — paused reader and the two missing RBAC builders

**Files:**
- Modify: `crates/usdcx-admin-notes/src/lib.rs` (imports at top; new fns after `pause`, around line 309)
- Modify: `crates/usdcx-admin-notes/src/wasm.rs` (after `build_rbac_revoke`, around line 233; after `enabled_attesters`)
- Test: `crates/usdcx-admin-notes/tests/builders.rs`, `crates/usdcx-admin-notes/tests/roles.rs`

**Interfaces:**
- Produces (Rust): `pub fn is_paused(account: &Account) -> bool`; `pub fn rbac_set_admin(target: AccountId, sender: AccountId, role: RoleSymbol, admin_role: Option<RoleSymbol>, serial: Word) -> Result<Note, AdminNoteError>`; `pub fn rbac_renounce(target: AccountId, sender: AccountId, role: RoleSymbol, serial: Word) -> Result<Note, AdminNoteError>`.
- Produces (wasm): `is_paused(account: &[u8]) -> Result<bool, JsError>`; `build_rbac_set_admin(target_hex, sender_hex, role, admin_role: Option<String>, serial) -> Result<Vec<u8>, JsError>`; `build_rbac_renounce(target_hex, sender_hex, role, serial) -> Result<Vec<u8>, JsError>`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/builders.rs` (it already imports `usdcx_admin_notes::testing::faucet_and_sender` and a `serial` helper; reuse them, or add this helper if the file lacks one):

```rust
use miden_protocol::utils::serde::{Deserializable, Serializable};
use miden_protocol::note::Note;
use miden_standards::note::config::RbacConfigNote;

#[test]
fn rbac_set_admin_targets_the_contract_and_round_trips() {
    let (faucet, sender) = faucet_and_sender();
    let role = usdcx_admin_notes::role_symbol("PAUSER").unwrap();
    let admin = usdcx_admin_notes::role_symbol("FEE_MNGR").unwrap();
    let note = usdcx_admin_notes::rbac_set_admin(faucet, sender, role, Some(admin), serial(1)).unwrap();
    assert_eq!(note.metadata().sender(), sender);
    assert_eq!(note.script().root(), RbacConfigNote::script_root().into());
    let back = Note::read_from_bytes(&note.to_bytes()).unwrap();
    assert_eq!(back, note);
}

#[test]
fn rbac_set_admin_accepts_none_to_revert_to_admin() {
    let (faucet, sender) = faucet_and_sender();
    let role = usdcx_admin_notes::role_symbol("PAUSER").unwrap();
    assert!(usdcx_admin_notes::rbac_set_admin(faucet, sender, role, None, serial(2)).is_ok());
}

#[test]
fn rbac_renounce_targets_the_contract_and_round_trips() {
    let (faucet, sender) = faucet_and_sender();
    let role = usdcx_admin_notes::role_symbol("PAUSER").unwrap();
    let note = usdcx_admin_notes::rbac_renounce(faucet, sender, role, serial(3)).unwrap();
    assert_eq!(note.metadata().sender(), sender);
    let back = Note::read_from_bytes(&note.to_bytes()).unwrap();
    assert_eq!(back, note);
}
```

If `note.script().root()` and `RbacConfigNote::script_root()` do not compare directly, compare `note.script().root()` against the root the existing `rbac` builder produces for a grant with the same ids (`usdcx_admin_notes::rbac(faucet, sender, RbacConfig::GrantRole{..}, serial(9)).unwrap().script().root()`).

Append to `tests/roles.rs`:

```rust
#[test]
fn role_symbol_accepts_bridge_role_names() {
    for name in ["ADMIN", "PAUSER", "FAUCET_MNGR", "GER_INJECTOR", "GER_REMOVER", "FEE_MNGR"] {
        assert!(usdcx_admin_notes::role_symbol(name).is_ok(), "{name}");
    }
    assert!(usdcx_admin_notes::role_symbol("pauser").is_err(), "lowercase is not a role symbol");
    assert!(usdcx_admin_notes::role_symbol("A VERY LONG ROLE NAME").is_err());
}

#[test]
fn is_paused_is_false_on_a_fresh_faucet() {
    let (faucet, _holder, _other) = usdcx_admin_notes::testing::faucet_with_admin();
    assert!(!usdcx_admin_notes::is_paused(&faucet));
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test -p usdcx-admin-notes --test builders --test roles 2>&1 | tail -20`
Expected: compile errors `cannot find function rbac_set_admin`, `rbac_renounce`, `is_paused` in crate `usdcx_admin_notes`.

- [ ] **Step 3: Implement**

In `src/lib.rs`, extend the standards import:

```rust
use miden_standards::account::access::{PausableStorage, RoleBasedAccessControl};
```

After `pub fn enabled_attesters` (before `admin_note_kinds`), add:

```rust
/// Whether the contract is currently paused: the `Pausable` component's `is_paused` value slot
/// (zero word = running, `[1, 0, 0, 0]` = paused). `false` if the slot is absent.
pub fn is_paused(account: &Account) -> bool {
    account
        .storage()
        .get_item(PausableStorage::is_paused_slot())
        .map(|w| w[0] == Felt::ONE)
        .unwrap_or(false)
}
```

After `pub fn pause`, add:

```rust
/// RBAC `SetRoleAdmin` (role: the target role's current effective admin). `admin_role = None`
/// reverts `role` to management by the default `ADMIN` role.
pub fn rbac_set_admin(
    target: AccountId,
    sender: AccountId,
    role: RoleSymbol,
    admin_role: Option<RoleSymbol>,
    serial: Word,
) -> Result<Note, AdminNoteError> {
    rbac(target, sender, RbacConfig::SetRoleAdmin { role, admin_role }, serial)
}

/// RBAC `RenounceRole`: the sender gives up `role` on the target contract.
pub fn rbac_renounce(
    target: AccountId,
    sender: AccountId,
    role: RoleSymbol,
    serial: Word,
) -> Result<Note, AdminNoteError> {
    rbac(target, sender, RbacConfig::RenounceRole { role }, serial)
}
```

In `src/wasm.rs`, after `enabled_attesters`:

```rust
/// Whether the contract (faucet or bridge) is paused, from its serialized `Account` bytes.
#[wasm_bindgen]
pub fn is_paused(account: &[u8]) -> Result<bool, JsError> {
    let account = Account::read_from_bytes(account).map_err(js)?;
    Ok(builders::is_paused(&account))
}
```

After `build_rbac_revoke`:

```rust
/// Build an RBAC set-role-admin note. `admin_role = None` reverts the role to `ADMIN` management.
#[wasm_bindgen]
pub fn build_rbac_set_admin(
    target_hex: &str,
    sender_hex: &str,
    role: &str,
    admin_role: Option<String>,
    serial: &[u8],
) -> Result<Vec<u8>, JsError> {
    let admin_role = match admin_role {
        Some(symbol) => Some(builders::role_symbol(&symbol).map_err(js)?),
        None => None,
    };
    let note = builders::rbac_set_admin(
        acct(target_hex)?,
        acct(sender_hex)?,
        builders::role_symbol(role).map_err(js)?,
        admin_role,
        word(serial)?,
    )
    .map_err(js)?;
    Ok(note.to_bytes())
}

/// Build an RBAC renounce note (the sender gives up `role`).
#[wasm_bindgen]
pub fn build_rbac_renounce(
    target_hex: &str,
    sender_hex: &str,
    role: &str,
    serial: &[u8],
) -> Result<Vec<u8>, JsError> {
    let note = builders::rbac_renounce(
        acct(target_hex)?,
        acct(sender_hex)?,
        builders::role_symbol(role).map_err(js)?,
        word(serial)?,
    )
    .map_err(js)?;
    Ok(note.to_bytes())
}
```

- [ ] **Step 4: Run the tests and clippy**

Run: `cargo test -p usdcx-admin-notes --test builders --test roles 2>&1 | tail -8 && cargo clippy -p usdcx-admin-notes --all-targets --features wasm,testing -- -D warnings 2>&1 | tail -3`
Expected: all tests pass; clippy clean. If `cargo clippy --features wasm` fails on a native target because of wasm-only deps, run clippy without `wasm` and separately `cargo check -p usdcx-admin-notes --features wasm --target wasm32-unknown-unknown`.

- [ ] **Step 5: Commit**

```bash
git add crates/usdcx-admin-notes/src/lib.rs crates/usdcx-admin-notes/src/wasm.rs crates/usdcx-admin-notes/tests/builders.rs crates/usdcx-admin-notes/tests/roles.rs
git commit -m "feat(admin-notes): is_paused reader and RBAC set-admin/renounce builders"
```

---

### Task 2: Crate — AggLayer bridge round trip on a MockChain

**Files:**
- Modify: `crates/usdcx-admin-notes/Cargo.toml` (`[dev-dependencies]`)
- Modify: `crates/usdcx-admin-notes/src/testing.rs` (new fixture at the end)
- Create: `crates/usdcx-admin-notes/tests/agglayer_roundtrip_0_17.rs`
- Modify: `crates/usdcx-admin-notes/tests/allowlist.rs`

**Interfaces:**
- Consumes: Task 1's `rbac_set_admin`, `rbac_renounce`, `is_paused`, plus existing `rbac`, `pause`, `account_has_role`.
- Produces: `usdcx_admin_notes::testing::mock_chain_with_bridge_roles() -> (MockChain, AccountId /*bridge*/, AccountId /*admin*/, AccountId /*pauser*/, AccountId /*other*/)`.

- [ ] **Step 1: Add the dev dependency**

In `Cargo.toml` `[dev-dependencies]`, add:

```toml
# The AggLayer bridge is a second RBAC + Pausable network account our RBAC/pause notes target.
# Dev-only: the published crate's `testing` fixtures build a deployed-equivalent bridge for the
# MockChain round trip (`tests/agglayer_roundtrip_0_17.rs`). Pinned to the testnet bridge's line.
miden-agglayer = { version = "=0.17.1", features = ["testing"] }
```

The fixture lives in `src/testing.rs` (feature `testing`), which is compiled into the lib, so `miden-agglayer` must also be an optional normal dependency there (same reason as `miden-testing`, see the comment on the `testing` feature). Add under `[dependencies]`:

```toml
miden-agglayer = { version = "=0.17.1", features = ["testing"], optional = true }
```

and extend the feature: `testing = ["dep:miden-testing", "dep:miden-agglayer"]`. Add `"miden-agglayer"` to `[package.metadata.cargo-machete] ignored` only if `cargo machete` flags it.

Run: `cargo fetch 2>&1 | tail -2` — expected: resolves `miden-agglayer v0.17.1` without a conflict (it depends on `miden-protocol 0.17.1`, the same pin).

- [ ] **Step 2: Write the fixture**

Append to `src/testing.rs`:

```rust
/// A `MockChain` holding a deployed-equivalent AggLayer bridge (the published `miden-agglayer`
/// crate's own testing builder) with `admin` holding the bridge's `ADMIN` (the spec's
/// BRIDGE_ADMIN), `pauser` holding `PAUSER`, and the four operational roles seeded to throwaway
/// ids. Returns `(chain, bridge_id, admin, pauser, other)`; `other` holds no role.
pub fn mock_chain_with_bridge_roles() -> (MockChain, AccountId, AccountId, AccountId, AccountId) {
    let admin = dummy_account_id(11);
    let pauser = dummy_account_id(12);
    let other = dummy_account_id(13);
    let operator = dummy_account_id(14);

    let bridge = miden_agglayer::testing::create_existing_bridge_account_with_roles(
        Word::from([Felt::new(7).unwrap(), Felt::ZERO, Felt::ZERO, Felt::ZERO]),
        admin,
        operator, // FAUCET_MNGR
        operator, // GER_INJECTOR
        operator, // GER_REMOVER
        operator, // FEE_MNGR
        pauser,
        86, // network id, arbitrary for the fixture
    );
    let bridge_id = bridge.id();
    let mut chain_builder = MockChain::builder();
    chain_builder.add_account(bridge).expect("registering the bridge account in the MockChain");
    let chain = chain_builder.build().expect("building the MockChain");
    (chain, bridge_id, admin, pauser, other)
}
```

- [ ] **Step 3: Write the failing round-trip tests**

Create `tests/agglayer_roundtrip_0_17.rs`:

```rust
//! Round-trip guard for the AggLayer bridge: the RBAC and pause notes this crate builds are
//! consumed by a deployed-equivalent 0.17 bridge (the published `miden-agglayer` crate's own
//! builder), and its role gates are enforced on chain.

use miden_protocol::account::{Account, StorageSlotPatch, StorageSlotName};
use miden_protocol::errors::MasmError;
use miden_protocol::transaction::ExecutedTransaction;
use miden_protocol::{Felt, Word};
use miden_standards::account::access::PausableStorage;
use miden_standards::note::config::RbacConfig;
use miden_testing::assert_transaction_executor_error;

use usdcx_admin_notes::testing::mock_chain_with_bridge_roles;

fn serial(n: u64) -> Word {
    Word::from([
        Felt::new(n).unwrap(),
        Felt::new(n + 1).unwrap(),
        Felt::new(n + 2).unwrap(),
        Felt::new(n + 3).unwrap(),
    ])
}

fn err_sender_lacks_role() -> MasmError {
    MasmError::from_static_str("note sender does not hold the required role")
}

fn value_delta(tx: &ExecutedTransaction, name: &StorageSlotName) -> Word {
    match tx.account_patch().storage().get(name) {
        Some(StorageSlotPatch::Value(w)) => w.value().expect("value patch carries a value"),
        other => panic!("value slot {name} expected a value delta, got {other:?}"),
    }
}

/// The bridge account after applying `tx`'s delta, for reading RBAC membership back.
fn account_after(chain: &miden_testing::MockChain, tx: &ExecutedTransaction) -> Account {
    let mut account = chain
        .committed_account(tx.account_id())
        .expect("the bridge is a committed account")
        .clone();
    account.apply_patch(tx.account_patch()).expect("applying the executed delta");
    account
}

#[tokio::test]
async fn admin_grants_pauser_on_the_bridge() {
    let (chain, bridge_id, admin, _pauser, other) = mock_chain_with_bridge_roles();
    let role = usdcx_admin_notes::role_symbol("PAUSER").unwrap();
    let note = usdcx_admin_notes::rbac(
        bridge_id,
        admin,
        RbacConfig::GrantRole { role: role.clone(), account: other },
        serial(200),
    )
    .unwrap();

    let tx = chain
        .build_transaction(bridge_id)
        .unauthenticated_input_note(note)
        .build()
        .unwrap()
        .execute()
        .await
        .expect("the bridge must consume an ADMIN-sent grant");

    let bridge = account_after(&chain, &tx);
    assert!(usdcx_admin_notes::account_has_role(&bridge, other, &role));
    assert_eq!(usdcx_admin_notes::rbac_role_members(&bridge, &role).len(), 2);
}

#[tokio::test]
async fn admin_revokes_pauser_on_the_bridge() {
    let (chain, bridge_id, admin, pauser, _other) = mock_chain_with_bridge_roles();
    let role = usdcx_admin_notes::role_symbol("PAUSER").unwrap();
    let note = usdcx_admin_notes::rbac(
        bridge_id,
        admin,
        RbacConfig::RevokeRole { role: role.clone(), account: pauser },
        serial(201),
    )
    .unwrap();
    let tx = chain
        .build_transaction(bridge_id)
        .unauthenticated_input_note(note)
        .build()
        .unwrap()
        .execute()
        .await
        .expect("the bridge must consume an ADMIN-sent revoke");
    let bridge = account_after(&chain, &tx);
    assert!(!usdcx_admin_notes::account_has_role(&bridge, pauser, &role));
}

#[tokio::test]
async fn non_admin_grant_fails_on_the_bridge() {
    let (chain, bridge_id, _admin, _pauser, other) = mock_chain_with_bridge_roles();
    let role = usdcx_admin_notes::role_symbol("PAUSER").unwrap();
    let note = usdcx_admin_notes::rbac(
        bridge_id,
        other,
        RbacConfig::GrantRole { role, account: other },
        serial(202),
    )
    .unwrap();
    let result = chain
        .build_transaction(bridge_id)
        .unauthenticated_input_note(note)
        .build()
        .unwrap()
        .execute()
        .await;
    assert_transaction_executor_error!(result, err_sender_lacks_role());
}

#[tokio::test]
async fn pauser_pauses_and_admin_unpauses_the_bridge() {
    let (chain, bridge_id, admin, pauser, _other) = mock_chain_with_bridge_roles();
    let pause = usdcx_admin_notes::pause(bridge_id, pauser, false, serial(203)).unwrap();
    let tx = chain
        .build_transaction(bridge_id)
        .unauthenticated_input_note(pause)
        .build()
        .unwrap()
        .execute()
        .await
        .expect("the bridge must consume a PAUSER-sent pause");
    assert_eq!(
        value_delta(&tx, PausableStorage::is_paused_slot()),
        Word::from([Felt::from(1u32), Felt::ZERO, Felt::ZERO, Felt::ZERO]),
    );
    let paused = account_after(&chain, &tx);
    assert!(usdcx_admin_notes::is_paused(&paused), "the reader must see the paused flag");

    // Unpause is ADMIN-gated: a PAUSER cannot, the ADMIN can.
    let by_pauser = usdcx_admin_notes::pause(bridge_id, pauser, true, serial(204)).unwrap();
    let result = chain
        .build_transaction(bridge_id)
        .unauthenticated_input_note(by_pauser)
        .build()
        .unwrap()
        .execute()
        .await;
    assert_transaction_executor_error!(result, err_sender_lacks_role());

    let by_admin = usdcx_admin_notes::pause(bridge_id, admin, true, serial(205)).unwrap();
    chain
        .build_transaction(bridge_id)
        .unauthenticated_input_note(by_admin)
        .build()
        .unwrap()
        .execute()
        .await
        .expect("the bridge must consume an ADMIN-sent unpause");
}

#[tokio::test]
async fn set_role_admin_and_renounce_apply_on_the_bridge() {
    let (chain, bridge_id, admin, pauser, _other) = mock_chain_with_bridge_roles();
    let pauser_role = usdcx_admin_notes::role_symbol("PAUSER").unwrap();
    let fee_role = usdcx_admin_notes::role_symbol("FEE_MNGR").unwrap();

    let set_admin = usdcx_admin_notes::rbac_set_admin(bridge_id, admin, pauser_role.clone(), Some(fee_role), serial(206)).unwrap();
    chain
        .build_transaction(bridge_id)
        .unauthenticated_input_note(set_admin)
        .build()
        .unwrap()
        .execute()
        .await
        .expect("the bridge must consume an ADMIN-sent set-role-admin");

    let renounce = usdcx_admin_notes::rbac_renounce(bridge_id, pauser, pauser_role.clone(), serial(207)).unwrap();
    let tx = chain
        .build_transaction(bridge_id)
        .unauthenticated_input_note(renounce)
        .build()
        .unwrap()
        .execute()
        .await
        .expect("the bridge must consume a holder's renounce");
    let bridge = account_after(&chain, &tx);
    assert!(!usdcx_admin_notes::account_has_role(&bridge, pauser, &pauser_role));
}
```

Notes for the implementer: the MockChain in this repo's existing tests is not mutated by `execute()`; each test uses a fresh chain and reads the post-state through the delta (`value_delta`) or by applying the patch to the committed account (`account_after`). If `MockChain::committed_account` or `Account::apply_patch` have different names in `miden-testing`/`miden-protocol` 0.17.1, find them with `grep -n "pub fn committed_account\|pub fn apply_patch\|pub fn apply_delta" ~/.cargo/registry/src/*/miden-testing-0.17.1/src/mock_chain/*.rs ~/.cargo/registry/src/*/miden-protocol-0.17.1/src/account/*.rs` and adapt the two helper bodies only. For the set-admin test, the chain state after the first note is not carried into the second; the renounce is independently valid (a holder may always renounce), so no chaining is needed.

Append to `tests/allowlist.rs`:

```rust
#[test]
fn bridge_allowlist_includes_the_rbac_and_pause_notes() {
    use miden_standards::note::config::{PauseConfigNote, RbacConfigNote};
    let allowed = miden_agglayer::AggLayerBridge::allowed_notes();
    assert!(allowed.contains(&RbacConfigNote::script_root()));
    assert!(allowed.contains(&PauseConfigNote::script_root()));
}
```

- [ ] **Step 4: Run and make green**

Run: `cargo test -p usdcx-admin-notes --test agglayer_roundtrip_0_17 --test allowlist 2>&1 | tail -15`
Expected: 5 + 1 pass. A failure mentioning an unresolved MAST root or missing library for the bridge's code means the executor did not preload the AggLayer package; in that case stop and report, do not stub.

- [ ] **Step 5: Commit**

```bash
git add crates/usdcx-admin-notes/Cargo.toml Cargo.lock crates/usdcx-admin-notes/src/testing.rs crates/usdcx-admin-notes/tests/agglayer_roundtrip_0_17.rs crates/usdcx-admin-notes/tests/allowlist.rs
git commit -m "test(admin-notes): RBAC and pause notes round-trip on a MockChain AggLayer bridge"
```

---

### Task 3: Re-vendor the wasm and guard the new exports from TypeScript

**Files:**
- Modify (generated): `bin/coordinator-frontend/src/lib/usdcxAdminWasm/usdcx_admin_notes{.js,.d.ts,_bg.wasm,_bg.wasm.d.ts}`
- Test: `bin/coordinator-frontend/tests/roundtrip/deserialize.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/roundtrip/deserialize.test.ts`, extend the import from `@/lib/usdcxAdminWasm/usdcx_admin_notes` with `build_rbac_set_admin, build_rbac_renounce, is_paused` and add inside the existing `describe`:

```ts
  test('build_rbac_set_admin', () => {
    const bytes = build_rbac_set_admin(FAUCET_HEX, SENDER_HEX, 'PAUSER', 'FEE_MNGR', nextSerial());
    expect(() => Note.deserialize(bytes)).not.toThrow();
    const reverted = build_rbac_set_admin(FAUCET_HEX, SENDER_HEX, 'PAUSER', undefined, nextSerial());
    expect(() => Note.deserialize(reverted)).not.toThrow();
  });

  test('build_rbac_renounce', () => {
    const bytes = build_rbac_renounce(FAUCET_HEX, SENDER_HEX, 'PAUSER', nextSerial());
    expect(() => Note.deserialize(bytes)).not.toThrow();
  });
```

and at file level:

```ts
test('is_paused survives vendoring', () => {
  expect(typeof is_paused).toBe('function');
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `bin/coordinator-frontend`): `npm run -s test:roundtrip 2>&1 | tail -8`
Expected: FAIL, `build_rbac_set_admin is not a function` (the vendored module predates Task 1).

- [ ] **Step 3: Rebuild and vendor**

From the worktree root:

```bash
wasm-pack build crates/usdcx-admin-notes --target web --features wasm --out-dir pkg 2>&1 | tail -3
for f in usdcx_admin_notes.js usdcx_admin_notes.d.ts usdcx_admin_notes_bg.wasm usdcx_admin_notes_bg.wasm.d.ts; do
  cp crates/usdcx-admin-notes/pkg/$f bin/coordinator-frontend/src/lib/usdcxAdminWasm/$f
done
grep -c "export function" bin/coordinator-frontend/src/lib/usdcxAdminWasm/usdcx_admin_notes.d.ts
```

Expected: the `.d.ts` lists `build_rbac_set_admin(target_hex: string, sender_hex: string, role: string, admin_role: string | null | undefined, serial: Uint8Array): Uint8Array`, `build_rbac_renounce(...)`, `is_paused(account: Uint8Array): boolean`, and all 19 previous exports.

- [ ] **Step 4: Run the roundtrip and admin suites**

Run: `npm run -s test:roundtrip 2>&1 | tail -4 && npm run -s test:admin 2>&1 | grep -E "Test Files|Tests "`
Expected: roundtrip all pass (incl. 3 new); admin 132 pass.

- [ ] **Step 5: Commit**

```bash
git add bin/coordinator-frontend/src/lib/usdcxAdminWasm bin/coordinator-frontend/tests/roundtrip/deserialize.test.ts
git commit -m "chore(frontend): re-vendor admin wasm with set-admin, renounce and is_paused"
```

---

### Task 4: Admin target profiles and configuration

**Files:**
- Create: `bin/coordinator-frontend/src/lib/admin/target.ts`
- Modify: `bin/coordinator-frontend/src/config/adminConfig.ts`
- Test: `bin/coordinator-frontend/tests/admin/target.test.ts`

**Interfaces (produces):**

```ts
export type AdminTargetKind = 'usdcx' | 'agglayer';
export interface RoleSpec { symbol: string; label: string; description: string }
export const ANY_HELD_ROLE = '*';
export interface AdminTargetProfile {
  kind: AdminTargetKind;
  roles: readonly RoleSpec[];
  actions: readonly AdminAction[];
  /** On-chain role symbol gating each action, or ANY_HELD_ROLE. */
  actionRole: Readonly<Partial<Record<AdminAction, string>>>;
  labelPrefix: string;            // 'usdcx_v1_' | 'agg_v1_'
  labels: { consoleTitle: string; contractNoun: string; contractShort: string; pauseTitle: string; unpauseTitle: string };
}
export interface AdminTarget extends AdminTargetProfile { contractId: string; feeFaucetId: string; networkId: string }
export const USDCX_PROFILE: AdminTargetProfile; export const AGGLAYER_PROFILE: AdminTargetProfile;
export function profileOf(kind: AdminTargetKind): AdminTargetProfile;
export function roleSymbols(t: AdminTargetProfile): string[];
export function roleLabel(t: AdminTargetProfile, symbol: string): string;   // 'ADMIN' -> 'BRIDGE_ADMIN' on agglayer
export function actionRoleOf(t: AdminTargetProfile, action: AdminAction): string | null; // null = action not on this target
// adminConfig.ts
export interface AdminConfig { faucetId: string; bridgeId: string; feeFaucetId: string; networkId: string }
export function getAdminTargets(): AdminTarget[];                     // configured ones, usdcx first
export function targetOfKind(kind: AdminTargetKind): AdminTarget | null;
```

Note: `AdminAction` gains `'rbac_set_admin' | 'rbac_renounce'` in Task 5; this task references them, so do Task 4 and Task 5's recipe edit together if `tsc` complains, but keep two commits.

- [ ] **Step 1: Write the failing test** `tests/admin/target.test.ts`

```ts
import { describe, it, expect, afterEach } from 'vitest';
import {
  AGGLAYER_PROFILE, ANY_HELD_ROLE, USDCX_PROFILE, actionRoleOf, profileOf, roleLabel, roleSymbols,
} from '@/lib/admin/target';
import { getAdminTargets, targetOfKind } from '@/config/adminConfig';

describe('profiles', () => {
  it('USDCx keeps its five roles and nine actions, in the existing order', () => {
    expect(roleSymbols(USDCX_PROFILE)).toEqual(['ADMIN', 'ATTEST_ADMIN', 'DOM_PAUSER', 'DOM_UNPAUSER', 'BLK_MANAGER']);
    expect(USDCX_PROFILE.actions).toEqual([
      'set_max_supply', 'set_min_burn', 'set_note_fee', 'rbac_grant', 'rbac_revoke', 'set_attester', 'pause', 'unpause', 'blocklist',
    ]);
    expect(actionRoleOf(USDCX_PROFILE, 'pause')).toBe('DOM_PAUSER');
    expect(actionRoleOf(USDCX_PROFILE, 'rbac_renounce')).toBeNull();
    expect(USDCX_PROFILE.labelPrefix).toBe('usdcx_v1_');
  });

  it('AggLayer has the six bridge roles, BRIDGE_ADMIN as the label of ADMIN, and six actions', () => {
    expect(roleSymbols(AGGLAYER_PROFILE)).toEqual(['ADMIN', 'PAUSER', 'FAUCET_MNGR', 'GER_INJECTOR', 'GER_REMOVER', 'FEE_MNGR']);
    expect(roleLabel(AGGLAYER_PROFILE, 'ADMIN')).toBe('BRIDGE_ADMIN');
    expect(roleLabel(USDCX_PROFILE, 'ADMIN')).toBe('ADMIN');
    expect(AGGLAYER_PROFILE.actions).toEqual(['rbac_grant', 'rbac_revoke', 'rbac_set_admin', 'rbac_renounce', 'pause', 'unpause']);
    expect(actionRoleOf(AGGLAYER_PROFILE, 'pause')).toBe('PAUSER');
    expect(actionRoleOf(AGGLAYER_PROFILE, 'unpause')).toBe('ADMIN');
    expect(actionRoleOf(AGGLAYER_PROFILE, 'rbac_renounce')).toBe(ANY_HELD_ROLE);
    expect(actionRoleOf(AGGLAYER_PROFILE, 'set_max_supply')).toBeNull();
    expect(AGGLAYER_PROFILE.labelPrefix).toBe('agg_v1_');
    expect(profileOf('agglayer')).toBe(AGGLAYER_PROFILE);
  });
});

describe('getAdminTargets', () => {
  const env = process.env;
  afterEach(() => { process.env = env; });

  it('lists only configured contracts, USDCx first', () => {
    process.env = { ...env, NEXT_PUBLIC_USDCX_FAUCET_ID: '0xaaa', NEXT_PUBLIC_USDCX_FEE_FAUCET_ID: '0xfee', NEXT_PUBLIC_AGGLAYER_BRIDGE_ID: '0xbbb', NEXT_PUBLIC_MIDEN_NETWORK: 'testnet' };
    const targets = getAdminTargets();
    expect(targets.map((t) => [t.kind, t.contractId, t.feeFaucetId, t.networkId])).toEqual([
      ['usdcx', '0xaaa', '0xfee', 'testnet'],
      ['agglayer', '0xbbb', '0xfee', 'testnet'],
    ]);
    expect(targetOfKind('agglayer')?.labels.contractNoun).toBe('AggLayer bridge');
  });

  it('omits AggLayer when the bridge id is unset', () => {
    process.env = { ...env, NEXT_PUBLIC_USDCX_FAUCET_ID: '0xaaa', NEXT_PUBLIC_USDCX_FEE_FAUCET_ID: '0xfee', NEXT_PUBLIC_AGGLAYER_BRIDGE_ID: '' };
    expect(getAdminTargets().map((t) => t.kind)).toEqual(['usdcx']);
    expect(targetOfKind('agglayer')).toBeNull();
  });

  it('is empty with nothing configured', () => {
    process.env = { ...env, NEXT_PUBLIC_USDCX_FAUCET_ID: '', NEXT_PUBLIC_AGGLAYER_BRIDGE_ID: '' };
    expect(getAdminTargets()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/target.test.ts 2>&1 | tail -5`
Expected: FAIL, cannot find module `@/lib/admin/target`.

- [ ] **Step 3: Implement** `src/lib/admin/target.ts`

```ts
import type { AdminAction } from '@/lib/admin/recipe';

/**
 * An admin *target* is the contract the console administers: the USDCx faucet or the AggLayer
 * bridge. Both are miden-standards RBAC + Pausable network accounts, so one engine serves both;
 * what differs (roles, actions, labels, the proposal-label prefix) lives in these profiles.
 */
export type AdminTargetKind = 'usdcx' | 'agglayer';

export interface RoleSpec {
  /** The on-chain role symbol (what the RBAC map and the wasm readers use). */
  symbol: string;
  /** What the UI shows; equals `symbol` except where the spec names a role differently. */
  label: string;
  description: string;
}

/** `actionRole` value for an action any role holder may perform (renounce). */
export const ANY_HELD_ROLE = '*';

export interface AdminTargetProfile {
  kind: AdminTargetKind;
  roles: readonly RoleSpec[];
  actions: readonly AdminAction[];
  actionRole: Readonly<Partial<Record<AdminAction, string>>>;
  /** The custom-proposal label prefix; see `encodeRecipeLabel`. */
  labelPrefix: string;
  labels: {
    consoleTitle: string;
    /** "USDCx faucet" / "AggLayer bridge", used in sentences. */
    contractNoun: string;
    /** "USDCx" / "AggLayer", for switcher chips and toasts. */
    contractShort: string;
    pauseTitle: string;
    unpauseTitle: string;
  };
}

export interface AdminTarget extends AdminTargetProfile {
  contractId: string;
  feeFaucetId: string;
  networkId: string;
}

export const USDCX_PROFILE: AdminTargetProfile = {
  kind: 'usdcx',
  roles: [
    { symbol: 'ADMIN', label: 'ADMIN', description: 'Root authority on the faucet: supply, fees, roles.' },
    { symbol: 'ATTEST_ADMIN', label: 'ATTEST_ADMIN', description: 'Enables and disables attesters.' },
    { symbol: 'DOM_PAUSER', label: 'DOM_PAUSER', description: 'Pauses the faucet domain.' },
    { symbol: 'DOM_UNPAUSER', label: 'DOM_UNPAUSER', description: 'Unpauses the faucet domain.' },
    { symbol: 'BLK_MANAGER', label: 'BLK_MANAGER', description: 'Blocks and unblocks accounts.' },
  ],
  actions: ['set_max_supply', 'set_min_burn', 'set_note_fee', 'rbac_grant', 'rbac_revoke', 'set_attester', 'pause', 'unpause', 'blocklist'],
  actionRole: {
    set_max_supply: 'ADMIN',
    set_min_burn: 'ADMIN',
    set_note_fee: 'ADMIN',
    rbac_grant: 'ADMIN',
    rbac_revoke: 'ADMIN',
    set_attester: 'ATTEST_ADMIN',
    pause: 'DOM_PAUSER',
    unpause: 'DOM_UNPAUSER',
    blocklist: 'BLK_MANAGER',
  },
  labelPrefix: 'usdcx_v1_',
  labels: {
    consoleTitle: 'USDCx Admin Console',
    contractNoun: 'USDCx faucet',
    contractShort: 'USDCx',
    pauseTitle: 'Pause USDCx',
    unpauseTitle: 'Unpause USDCx',
  },
};

export const AGGLAYER_PROFILE: AdminTargetProfile = {
  kind: 'agglayer',
  roles: [
    // The bridge's root role is the standards `ADMIN` symbol; the AggLayer spec calls it BRIDGE_ADMIN.
    { symbol: 'ADMIN', label: 'BRIDGE_ADMIN', description: 'Root authority. Grants and revokes every role, unpauses, updates policies. Must never be emptied.' },
    { symbol: 'PAUSER', label: 'PAUSER', description: 'Emergency stop. Pause only; unpause sits with BRIDGE_ADMIN.' },
    { symbol: 'FAUCET_MNGR', label: 'FAUCET_MNGR', description: 'Registers and deregisters bridged-token faucets (operational Gateway key).' },
    { symbol: 'GER_INJECTOR', label: 'GER_INJECTOR', description: 'Publishes new Global Exit Roots (operational Gateway key).' },
    { symbol: 'GER_REMOVER', label: 'GER_REMOVER', description: 'Removes a fraudulent or mistaken GER; works while paused.' },
    { symbol: 'FEE_MNGR', label: 'FEE_MNGR', description: "Updates the bridge's note fee schedule." },
  ],
  actions: ['rbac_grant', 'rbac_revoke', 'rbac_set_admin', 'rbac_renounce', 'pause', 'unpause'],
  actionRole: {
    rbac_grant: 'ADMIN',
    rbac_revoke: 'ADMIN',
    rbac_set_admin: 'ADMIN',
    rbac_renounce: ANY_HELD_ROLE,
    pause: 'PAUSER',
    unpause: 'ADMIN',
  },
  labelPrefix: 'agg_v1_',
  labels: {
    consoleTitle: 'AggLayer Bridge Admin Console',
    contractNoun: 'AggLayer bridge',
    contractShort: 'AggLayer',
    pauseTitle: 'Pause bridge',
    unpauseTitle: 'Unpause bridge',
  },
};

const PROFILES: Record<AdminTargetKind, AdminTargetProfile> = { usdcx: USDCX_PROFILE, agglayer: AGGLAYER_PROFILE };

export function profileOf(kind: AdminTargetKind): AdminTargetProfile {
  return PROFILES[kind];
}

export function roleSymbols(target: AdminTargetProfile): string[] {
  return target.roles.map((r) => r.symbol);
}

export function roleLabel(target: AdminTargetProfile, symbol: string): string {
  return target.roles.find((r) => r.symbol === symbol)?.label ?? symbol;
}

/** The on-chain role gating `action` on this target, `ANY_HELD_ROLE`, or `null` when the target has no such action. */
export function actionRoleOf(target: AdminTargetProfile, action: AdminAction): string | null {
  return target.actions.includes(action) ? (target.actionRole[action] ?? null) : null;
}
```

Replace `src/config/adminConfig.ts` with:

```ts
import { AGGLAYER_PROFILE, USDCX_PROFILE, type AdminTarget, type AdminTargetKind } from '@/lib/admin/target';

export interface AdminConfig {
  faucetId: string;
  bridgeId: string;
  feeFaucetId: string;
  networkId: string;
}

/** Never throws at import — safe for the default wallet build. */
export function getAdminConfig(): AdminConfig {
  return {
    faucetId: process.env.NEXT_PUBLIC_USDCX_FAUCET_ID ?? '',
    bridgeId: process.env.NEXT_PUBLIC_AGGLAYER_BRIDGE_ID ?? '',
    feeFaucetId: process.env.NEXT_PUBLIC_USDCX_FEE_FAUCET_ID ?? '',
    networkId: process.env.NEXT_PUBLIC_MIDEN_NETWORK ?? 'devnet',
  };
}

/**
 * The contracts this build can administer, in display order. A target is present only when its
 * contract id is configured; with the bridge id unset the console is USDCx-only, exactly as before.
 */
export function getAdminTargets(): AdminTarget[] {
  const cfg = getAdminConfig();
  const targets: AdminTarget[] = [];
  if (cfg.faucetId) targets.push({ ...USDCX_PROFILE, contractId: cfg.faucetId, feeFaucetId: cfg.feeFaucetId, networkId: cfg.networkId });
  if (cfg.bridgeId) targets.push({ ...AGGLAYER_PROFILE, contractId: cfg.bridgeId, feeFaucetId: cfg.feeFaucetId, networkId: cfg.networkId });
  return targets;
}

export function targetOfKind(kind: AdminTargetKind): AdminTarget | null {
  return getAdminTargets().find((t) => t.kind === kind) ?? null;
}
```

(`assertAdminConfig` had no call site; it is removed. `grep -rn assertAdminConfig src tests docs` must show only `docs/DEPLOY_VERCEL.md`; fix that sentence in Task 11.)

- [ ] **Step 4: Run the test**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/target.test.ts 2>&1 | tail -5`
Expected: PASS (6 tests). `tsc` may fail until Task 5 adds the two actions; that is expected and resolved in Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/target.ts src/config/adminConfig.ts tests/admin/target.test.ts
git commit -m "feat(admin): target profiles for USDCx and the AggLayer bridge; bridge id config"
```

---

### Task 5: Recipe, note building and descriptions per target

**Files:**
- Modify: `src/lib/admin/recipe.ts`, `src/lib/admin/noteBuilders.ts` (`buildAdminNoteBytes`), `src/lib/admin/describe.ts`
- Test: `tests/admin/recipe.test.ts`, `tests/admin/noteBuilders.test.ts`, `tests/admin/describe.test.ts`

**Interfaces (produces):**

```ts
export type AdminAction = ... | 'rbac_set_admin' | 'rbac_renounce';
export type AdminActionArgs = ... | { action: 'rbac_set_admin'; role: string; adminRole: string | null } | { action: 'rbac_renounce'; role: string };
export interface AdminRecipe { ...; /** absent = 'usdcx' */ target?: AdminTargetKind; faucetId: string /* the target contract id */ }
export function recipeTarget(r: AdminRecipe): AdminTargetKind;
export function encodeRecipeLabel(r): string;      // prefix from profileOf(recipeTarget(r)).labelPrefix
export function decodeRecipeLabel(label): AdminRecipe | null;  // accepts both prefixes
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/admin/recipe.test.ts`:

```ts
import { recipeTarget } from '@/lib/admin/recipe';

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
```

In `tests/admin/noteBuilders.test.ts`, extend the `cases` array inside `builds a deserializable note for every action`:

```ts
      recipe('rbac_set_admin', { action: 'rbac_set_admin', role: 'PAUSER', adminRole: 'FEE_MNGR' }),
      recipe('rbac_set_admin', { action: 'rbac_set_admin', role: 'PAUSER', adminRole: null }),
      recipe('rbac_renounce', { action: 'rbac_renounce', role: 'PAUSER' }),
```

and add a test that the target contract id flows into the note:

```ts
  it('addresses the note to the recipe contract id, whichever target', () => {
    const base = recipe('rbac_renounce', { action: 'rbac_renounce', role: 'PAUSER' });
    const note = Note.deserialize(buildAdminNoteBytes({ ...base, target: 'agglayer', faucetId: OTHER }));
    expect(note.metadata().sender().toString().toLowerCase()).toBe(SENDER);
    // The tag encodes the target account; a different contract id gives a different tag.
    const usdcx = Note.deserialize(buildAdminNoteBytes(base));
    expect(note.metadata().tag().asU32()).not.toBe(usdcx.metadata().tag().asU32());
  });
```

(If the SDK names differ, `grep -n "tag\|sender" node_modules/@miden-sdk/miden-sdk/dist/st/index.d.ts | head` and adapt the two accessor names only.)

Append to `tests/admin/describe.test.ts`:

```ts
  it('describes the bridge actions with target wording', () => {
    const bridge = (actionArgs: AdminActionArgs): AdminRecipe => ({ ...recipeFor(actionArgs), target: 'agglayer' });
    expect(describeAdminRecipe(bridge({ action: 'pause' })).title).toBe('Pause bridge');
    expect(describeAdminRecipe(bridge({ action: 'unpause' })).title).toBe('Unpause bridge');
    expect(describeAdminRecipe(bridge({ action: 'rbac_set_admin', role: 'PAUSER', adminRole: null }))).toEqual({
      title: 'Set role admin', lines: ['Role: PAUSER', 'Admin role: BRIDGE_ADMIN (default)'],
    });
    expect(describeAdminRecipe(bridge({ action: 'rbac_set_admin', role: 'PAUSER', adminRole: 'FEE_MNGR' })).lines).toEqual(['Role: PAUSER', 'Admin role: FEE_MNGR']);
    expect(describeAdminRecipe(bridge({ action: 'rbac_renounce', role: 'PAUSER' }))).toEqual({ title: 'Renounce role', lines: ['Role: PAUSER'] });
    expect(describeAdminRecipe(bridge({ action: 'rbac_grant', role: 'ADMIN', accountId: '0x1' })).lines[0]).toBe('Role: BRIDGE_ADMIN');
    // USDCx titles unchanged
    expect(describeAdminRecipe(recipeFor({ action: 'pause' })).title).toBe('Pause USDCx');
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/recipe.test.ts tests/admin/noteBuilders.test.ts tests/admin/describe.test.ts 2>&1 | grep -E "×|FAIL|Tests " | head`
Expected: type/runtime failures on the new actions and `recipeTarget`.

- [ ] **Step 3: Implement**

`src/lib/admin/recipe.ts`:
- Add to `AdminAction`: `| 'rbac_set_admin' | 'rbac_renounce'`.
- Add to `AdminActionArgs`: `| { action: 'rbac_set_admin'; role: string; adminRole: string | null } | { action: 'rbac_renounce'; role: string }`.
- Import `import { profileOf, type AdminTargetKind } from '@/lib/admin/target';` and add to `AdminRecipe` (doc the field): `/** The contract kind; absent on recipes created before the AggLayer console = 'usdcx'. */ target?: AdminTargetKind;` and reword the `faucetId` doc comment to "the target contract id (faucet or bridge); the name predates the bridge".
- Replace `const LABEL_PREFIX = 'usdcx_v1_';` with:

```ts
export function recipeTarget(r: Pick<AdminRecipe, 'target'>): AdminTargetKind {
  return r.target ?? 'usdcx';
}
const LABEL_PREFIXES: readonly AdminTargetKind[] = ['usdcx', 'agglayer'];
```

- `encodeRecipeLabel`: `return profileOf(recipeTarget(r)).labelPrefix + base32Encode(JSON.stringify(rest));`
- `decodeRecipeLabel`:

```ts
export function decodeRecipeLabel(label: string): AdminRecipe | null {
  const kind = LABEL_PREFIXES.find((k) => label.startsWith(profileOf(k).labelPrefix));
  if (!kind) return null;
  try {
    const json = base32Decode(label.slice(profileOf(kind).labelPrefix.length));
    return JSON.parse(json) as AdminRecipe;
  } catch {
    return null;
  }
}
```

`src/lib/admin/noteBuilders.ts`, in `buildAdminNoteBytes` after the `rbac_revoke` case:

```ts
    case 'rbac_set_admin':
      return wasm.build_rbac_set_admin(faucet, sender, r.actionArgs.role, r.actionArgs.adminRole ?? undefined, serial);

    case 'rbac_renounce':
      return wasm.build_rbac_renounce(faucet, sender, r.actionArgs.role, serial);
```

`src/lib/admin/describe.ts`: import `profileOf, roleLabel` and `recipeTarget`; at the top of the function `const target = profileOf(recipeTarget(recipe));`; then:

```ts
    case 'rbac_grant':
      return { title: 'Grant role', lines: [`Role: ${roleLabel(target, args.role)}`, `Target: ${args.accountId}`] };
    case 'rbac_revoke':
      return { title: 'Revoke role', lines: [`Role: ${roleLabel(target, args.role)}`, `Target: ${args.accountId}`] };
    case 'rbac_set_admin':
      return {
        title: 'Set role admin',
        lines: [
          `Role: ${roleLabel(target, args.role)}`,
          `Admin role: ${args.adminRole ? roleLabel(target, args.adminRole) : `${roleLabel(target, 'ADMIN')} (default)`}`,
        ],
      };
    case 'rbac_renounce':
      return { title: 'Renounce role', lines: [`Role: ${roleLabel(target, args.role)}`] };
    case 'pause':
      return { title: target.labels.pauseTitle, lines: [] };
    case 'unpause':
      return { title: target.labels.unpauseTitle, lines: [] };
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/recipe.test.ts tests/admin/noteBuilders.test.ts tests/admin/describe.test.ts tests/admin/target.test.ts 2>&1 | grep -E "Tests " && npm run -s typecheck 2>&1 | head`
Expected: all pass. `typecheck` will list the exhaustiveness errors in `roles.ts` (`ACTION_ROLE`, `ACTION_LABEL`, `ACTION_INFO` are `Record<AdminAction, …>`) — those are fixed in Task 6; everything else must be clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/recipe.ts src/lib/admin/noteBuilders.ts src/lib/admin/describe.ts tests/admin/recipe.test.ts tests/admin/noteBuilders.test.ts tests/admin/describe.test.ts
git commit -m "feat(admin): recipes carry a target; set-role-admin and renounce actions; agg_v1_ labels"
```

---

### Task 6: Roles, action info and sender resolution per target

**Files:**
- Modify: `src/lib/admin/roles.ts`, `src/lib/admin/directAction.ts` (`resolveActionSender`), `src/lib/admin/validation.ts`
- Test: `tests/admin/roles.test.ts`, `tests/admin/directAction.test.ts`, `tests/admin/validation.test.ts`

**Interfaces (produces):**

```ts
export type Role = string;
export type RoleFlags = Record<string, boolean>;
export const ROLES: readonly string[]  // = roleSymbols(USDCX_PROFILE), kept for callers that still mean USDCx
export function rolesFromChecker(target: AdminTargetProfile, check: (role: string) => boolean): RoleFlags;
export function evaluateRoles(contractBytes: Uint8Array, accountHex: string, target: AdminTargetProfile): RoleFlags;
export function holdersFromLister(target: AdminTargetProfile, list: (role: string) => string[]): Record<string, string[]>;
export function listRoleHolders(contractBytes: Uint8Array, target: AdminTargetProfile): Record<string, string[]>;
export function actionsOfRole(target: AdminTargetProfile, role: string): AdminAction[];
export function actionLabel(target: AdminTargetProfile, action: AdminAction): string;
export function actionInfo(target: AdminTargetProfile, action: AdminAction): { title: string; description: string };
export function holdsAnyRole(flags: RoleFlags | null): boolean;
// directAction.ts
export function resolveActionSender(action: AdminAction, target: AdminTargetProfile, multisigRoles: RoleFlags | null, breadRoles: RoleFlags | null): ActionSender | null;
// validation.ts
export function isRoleSymbol(input: string): boolean;   // /^[A-Z_]{1,12}$/
```

Keep the old exports `ACTION_ROLE`, `ACTION_LABEL`, `ACTION_INFO` only as USDCx-bound aliases if any non-test file still imports them after Task 9; the goal is that nothing does.

- [ ] **Step 1: Write the failing tests**

Replace the contents of `tests/admin/roles.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import {
  ROLES, actionInfo, actionLabel, actionsOfRole, holdersFromLister, holdsAnyRole, rolesFromChecker,
} from '@/lib/admin/roles';
import { AGGLAYER_PROFILE, USDCX_PROFILE, actionRoleOf } from '@/lib/admin/target';

describe('USDCx action gating is unchanged', () => {
  it('maps the nine actions to their roles', () => {
    expect(actionRoleOf(USDCX_PROFILE, 'pause')).toBe('DOM_PAUSER');
    expect(actionRoleOf(USDCX_PROFILE, 'unpause')).toBe('DOM_UNPAUSER');
    expect(actionRoleOf(USDCX_PROFILE, 'blocklist')).toBe('BLK_MANAGER');
    expect(actionRoleOf(USDCX_PROFILE, 'set_attester')).toBe('ATTEST_ADMIN');
    for (const a of ['set_max_supply', 'set_min_burn', 'set_note_fee', 'rbac_grant', 'rbac_revoke'] as const) {
      expect(actionRoleOf(USDCX_PROFILE, a)).toBe('ADMIN');
    }
    expect(ROLES).toEqual(['ADMIN', 'ATTEST_ADMIN', 'DOM_PAUSER', 'DOM_UNPAUSER', 'BLK_MANAGER']);
  });
});

describe('rolesFromChecker / holdersFromLister', () => {
  it('evaluates exactly the target roles, once each', () => {
    const seen: string[] = [];
    const flags = rolesFromChecker(AGGLAYER_PROFILE, (role) => { seen.push(role); return role === 'PAUSER'; });
    expect(seen).toEqual(['ADMIN', 'PAUSER', 'FAUCET_MNGR', 'GER_INJECTOR', 'GER_REMOVER', 'FEE_MNGR']);
    expect(flags).toEqual({ ADMIN: false, PAUSER: true, FAUCET_MNGR: false, GER_INJECTOR: false, GER_REMOVER: false, FEE_MNGR: false });
    expect(holdersFromLister(USDCX_PROFILE, (role) => (role === 'ADMIN' ? ['0x1'] : []))).toEqual({
      ADMIN: ['0x1'], ATTEST_ADMIN: [], DOM_PAUSER: [], DOM_UNPAUSER: [], BLK_MANAGER: [],
    });
  });
  it('holdsAnyRole', () => {
    expect(holdsAnyRole(null)).toBe(false);
    expect(holdsAnyRole({ ADMIN: false })).toBe(false);
    expect(holdsAnyRole({ ADMIN: false, PAUSER: true })).toBe(true);
  });
});

describe('actionsOfRole / labels', () => {
  it('lists what each bridge role can do, renounce for every role', () => {
    expect(actionsOfRole(AGGLAYER_PROFILE, 'ADMIN')).toEqual(['rbac_grant', 'rbac_revoke', 'rbac_set_admin', 'rbac_renounce', 'unpause']);
    expect(actionsOfRole(AGGLAYER_PROFILE, 'PAUSER')).toEqual(['rbac_renounce', 'pause']);
    expect(actionsOfRole(AGGLAYER_PROFILE, 'FEE_MNGR')).toEqual(['rbac_renounce']);
    expect(actionsOfRole(USDCX_PROFILE, 'DOM_PAUSER')).toEqual(['pause']);
  });
  it('titles follow the target', () => {
    expect(actionInfo(USDCX_PROFILE, 'pause').title).toBe('Pause USDCx');
    expect(actionInfo(AGGLAYER_PROFILE, 'pause').title).toBe('Pause bridge');
    expect(actionInfo(AGGLAYER_PROFILE, 'rbac_set_admin').title).toBe('Set role admin');
    expect(actionLabel(AGGLAYER_PROFILE, 'rbac_renounce')).toBe('Renounce a held role');
    expect(actionLabel(AGGLAYER_PROFILE, 'pause')).toBe('Pause the bridge');
    expect(actionLabel(USDCX_PROFILE, 'pause')).toBe('Pause the faucet');
  });
});
```

In `tests/admin/directAction.test.ts`, replace the `resolveActionSender` describe with:

```ts
describe('resolveActionSender', () => {
  const none = { ADMIN: false, ATTEST_ADMIN: false, DOM_PAUSER: false, DOM_UNPAUSER: false, BLK_MANAGER: false };
  const bridgeNone = { ADMIN: false, PAUSER: false, FAUCET_MNGR: false, GER_INJECTOR: false, GER_REMOVER: false, FEE_MNGR: false };

  it('prefers the multisig when it holds the role', () => {
    expect(resolveActionSender('pause', USDCX_PROFILE, { ...none, DOM_PAUSER: true }, { ...none, DOM_PAUSER: true })).toBe('multisig');
    expect(resolveActionSender('pause', USDCX_PROFILE, { ...none, DOM_PAUSER: true }, null)).toBe('multisig');
  });
  it('falls back to the Bread account when only it holds the role', () => {
    expect(resolveActionSender('pause', USDCX_PROFILE, none, { ...none, DOM_PAUSER: true })).toBe('bread');
    expect(resolveActionSender('unpause', USDCX_PROFILE, none, { ...none, DOM_PAUSER: true })).toBe(null);
  });
  it('is locked when neither holds the role or nothing is known', () => {
    expect(resolveActionSender('pause', USDCX_PROFILE, none, none)).toBe(null);
    expect(resolveActionSender('pause', USDCX_PROFILE, null, null)).toBe(null);
  });
  it('uses the bridge gating on the bridge and never offers actions the target lacks', () => {
    expect(resolveActionSender('pause', AGGLAYER_PROFILE, { ...bridgeNone, PAUSER: true }, null)).toBe('multisig');
    expect(resolveActionSender('unpause', AGGLAYER_PROFILE, { ...bridgeNone, PAUSER: true }, null)).toBe(null);
    expect(resolveActionSender('unpause', AGGLAYER_PROFILE, { ...bridgeNone, ADMIN: true }, null)).toBe('multisig');
    expect(resolveActionSender('set_max_supply', AGGLAYER_PROFILE, { ...bridgeNone, ADMIN: true }, null)).toBe(null);
  });
  it('offers renounce to any role holder, multisig first', () => {
    expect(resolveActionSender('rbac_renounce', AGGLAYER_PROFILE, { ...bridgeNone, FEE_MNGR: true }, null)).toBe('multisig');
    expect(resolveActionSender('rbac_renounce', AGGLAYER_PROFILE, bridgeNone, { ...bridgeNone, PAUSER: true })).toBe('bread');
    expect(resolveActionSender('rbac_renounce', AGGLAYER_PROFILE, bridgeNone, bridgeNone)).toBe(null);
  });
});
```

(add `import { AGGLAYER_PROFILE, USDCX_PROFILE } from '@/lib/admin/target';` and drop the now-unused `Role` import.)

Append to `tests/admin/validation.test.ts`:

```ts
import { isRoleSymbol } from '@/lib/admin/validation';
describe('isRoleSymbol', () => {
  it('accepts A-Z and _ up to 12 chars, rejects the rest', () => {
    for (const ok of ['ADMIN', 'PAUSER', 'GER_INJECTOR', 'A', 'FAUCET_MNGR']) expect(isRoleSymbol(ok)).toBe(true);
    for (const bad of ['', 'pauser', 'PAUSER ', 'A VERY LONG ROLE', 'ROLE-1', 'ADMINISTRATOR']) expect(isRoleSymbol(bad)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/roles.test.ts tests/admin/directAction.test.ts tests/admin/validation.test.ts 2>&1 | grep -E "FAIL|Tests " | head -5`
Expected: FAIL (missing exports / wrong arity).

- [ ] **Step 3: Implement**

Replace `src/lib/admin/roles.ts` with:

```ts
import { account_has_role, rbac_role_members } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import type { AdminAction } from '@/lib/admin/recipe';
import { ANY_HELD_ROLE, USDCX_PROFILE, actionRoleOf, roleSymbols, type AdminTargetProfile } from '@/lib/admin/target';

/** An on-chain role symbol. The set depends on the target (see `lib/admin/target`). */
export type Role = string;
/** Which of a target's roles an account holds, keyed by on-chain symbol. */
export type RoleFlags = Record<string, boolean>;

/** The USDCx faucet's roles; kept for callers that specifically mean USDCx. */
export const ROLES: readonly string[] = roleSymbols(USDCX_PROFILE);

/** Pure role evaluator over a target's roles; testable without serialized account bytes. */
export function rolesFromChecker(target: AdminTargetProfile, check: (role: string) => boolean): RoleFlags {
  const result: RoleFlags = {};
  for (const role of roleSymbols(target)) result[role] = check(role);
  return result;
}

/**
 * Evaluates every role of `target` for `accountHex` against the already-fetched, serialized
 * contract `Account` bytes. Callers fetch the bytes and run `initAdminWasm()` first.
 */
export function evaluateRoles(contractBytes: Uint8Array, accountHex: string, target: AdminTargetProfile): RoleFlags {
  return rolesFromChecker(target, (role) => account_has_role(contractBytes, accountHex, role));
}

export function holdsAnyRole(flags: RoleFlags | null): boolean {
  return !!flags && Object.values(flags).some(Boolean);
}

export function holdersFromLister(target: AdminTargetProfile, list: (role: string) => string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const role of roleSymbols(target)) result[role] = list(role);
  return result;
}

export function listRoleHolders(contractBytes: Uint8Array, target: AdminTargetProfile): Record<string, string[]> {
  return holdersFromLister(target, (role) => rbac_role_members(contractBytes, role));
}

/** The target's actions `role` unlocks (renounce is open to every role holder). */
export function actionsOfRole(target: AdminTargetProfile, role: string): AdminAction[] {
  return target.actions.filter((action) => {
    const gate = actionRoleOf(target, action);
    return gate === role || gate === ANY_HELD_ROLE;
  });
}

/** Short, human-readable name of what each admin action does, for listing a role's powers. */
export function actionLabel(target: AdminTargetProfile, action: AdminAction): string {
  const noun = target.kind === 'agglayer' ? 'bridge' : 'faucet';
  switch (action) {
    case 'set_max_supply': return 'Set the max supply';
    case 'set_min_burn': return 'Set the minimum burn amount';
    case 'set_note_fee': return 'Set note fees';
    case 'rbac_grant': return 'Grant roles';
    case 'rbac_revoke': return 'Revoke roles';
    case 'rbac_set_admin': return "Change a role's admin role";
    case 'rbac_renounce': return 'Renounce a held role';
    case 'set_attester': return 'Enable or disable attesters';
    case 'pause': return `Pause the ${noun}`;
    case 'unpause': return `Unpause the ${noun}`;
    case 'blocklist': return 'Block or unblock accounts';
  }
}

/** Card title and one-line description of each admin action, as shown on the admin page. */
export function actionInfo(target: AdminTargetProfile, action: AdminAction): { title: string; description: string } {
  const noun = target.labels.contractNoun;
  switch (action) {
    case 'set_max_supply': return { title: 'Set max supply', description: "Sets the faucet's maximum issuable supply, in base units." };
    case 'set_min_burn': return { title: 'Set min burn', description: 'Sets the minimum amount that can be burned, in base units.' };
    case 'set_note_fee': return { title: 'Set note fee', description: 'Sets the fee required to submit notes using a given note script.' };
    case 'rbac_grant': return { title: 'Grant role', description: `Grants an RBAC role to an account on the ${noun}.` };
    case 'rbac_revoke': return { title: 'Revoke role', description: `Revokes an RBAC role from an account on the ${noun}.` };
    case 'rbac_set_admin': return { title: 'Set role admin', description: 'Changes which role administers a role (grants, revokes). Empty reverts to the root admin role.' };
    case 'rbac_renounce': return { title: 'Renounce role', description: `Gives up a role the sender holds on the ${noun}. Cannot be undone by the sender.` };
    case 'set_attester': return { title: 'Set attester', description: 'Enables or disables an attester commitment for this faucet.' };
    case 'pause': return { title: target.labels.pauseTitle, description: target.kind === 'agglayer' ? 'Emergency stop: blocks bridge-out, claims, GER injection and faucet changes.' : 'Pauses all transfers and operations on this faucet.' };
    case 'unpause': return { title: target.labels.unpauseTitle, description: target.kind === 'agglayer' ? 'Resumes bridge operations. BRIDGE_ADMIN only.' : 'Resumes transfers and operations on this faucet.' };
    case 'blocklist': return { title: 'Block or unblock account', description: "Adds or removes an account from this faucet's blocklist." };
  }
}
```

In `src/lib/admin/directAction.ts`, replace `resolveActionSender` (and its `ACTION_ROLE`/`Role` imports) with:

```ts
import { ANY_HELD_ROLE, actionRoleOf, type AdminTargetProfile } from '@/lib/admin/target';
import { holdsAnyRole, type RoleFlags } from '@/lib/admin/roles';

/**
 * Picks the sender for `action` on `target` from who holds its gating role: the multisig when it
 * does (the reviewed, co-signed path), else the connected Bread account, else nobody. An action
 * the target does not offer, or unknown roles (`null`), never unlocks anything. Renounce
 * (`ANY_HELD_ROLE`) is open to whichever party holds any role at all.
 */
export function resolveActionSender(
  action: AdminAction,
  target: AdminTargetProfile,
  multisigRoles: RoleFlags | null,
  breadRoles: RoleFlags | null,
): ActionSender | null {
  const gate = actionRoleOf(target, action);
  if (gate === null) return null;
  const holds = (flags: RoleFlags | null) => (gate === ANY_HELD_ROLE ? holdsAnyRole(flags) : !!flags?.[gate]);
  if (holds(multisigRoles)) return 'multisig';
  if (holds(breadRoles)) return 'bread';
  return null;
}
```

In `src/lib/admin/validation.ts` add:

```ts
/** A miden-standards `RoleSymbol`: 1-12 characters from A-Z and underscore. */
export function isRoleSymbol(input: string): boolean {
  return /^[A-Z_]{1,12}$/.test(input);
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/roles.test.ts tests/admin/directAction.test.ts tests/admin/validation.test.ts 2>&1 | grep -E "Tests " && npm run -s typecheck 2>&1 | head -20`
Expected: tests pass. Remaining `typecheck` errors are only in UI files that still import `ACTION_INFO`/`ACTION_ROLE`/`ACTION_LABEL`/`ROLES`-typed records (`LockedActionCard`, forms, pages, `AdminBanner`, `useFaucetRoles`); they are rewritten in Tasks 8-9. List them in the commit body.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/roles.ts src/lib/admin/directAction.ts src/lib/admin/validation.ts tests/admin/roles.test.ts tests/admin/directAction.test.ts tests/admin/validation.test.ts
git commit -m "feat(admin): role evaluation, action info and sender resolution per target"
```

---

### Task 7: Guardrails per target

**Files:**
- Modify: `src/lib/admin/guardrails.ts`
- Test: `tests/admin/guardrails.test.ts`

**Interfaces (produces):**

```ts
export function decideLastAdmin(adminMembers: string[], actingAccountId: string, recipe: AdminRecipe, target: AdminTargetProfile): GuardrailResult; // now also covers rbac_renounce of ADMIN
export function decideRoleSeparation(recipe, actingAccountId): GuardrailResult;  // unchanged; USDCx roles only match by name
export function decideRevokeInFlight(recipe, inflight): GuardrailResult;        // unchanged
export function decideAdminChurnInFlight(recipe: AdminRecipe, inflight: AdminRecipe[]): GuardrailResult; // agglayer: warn
export async function runGuardrails(contractBytes: Uint8Array, target: AdminTargetProfile, recipe: AdminRecipe, inflight: AdminRecipe[]): Promise<GuardrailResult>;
```

- [ ] **Step 1: Write the failing tests** (append to `tests/admin/guardrails.test.ts`; its `recipe()` helper and `expectLevel` exist)

```ts
import { decideAdminChurnInFlight } from '@/lib/admin/guardrails';
import { AGGLAYER_PROFILE, USDCX_PROFILE } from '@/lib/admin/target';

const bridgeRecipe = (over: Partial<AdminRecipe> = {}): AdminRecipe => recipe({ target: 'agglayer', ...over });

describe('bridge guardrails', () => {
  it('blocks renouncing the last BRIDGE_ADMIN', () => {
    const r = bridgeRecipe({ action: 'rbac_renounce', actionArgs: { action: 'rbac_renounce', role: 'ADMIN' } });
    expectLevel(decideLastAdmin([SELF], SELF, r, AGGLAYER_PROFILE), 'block');
    expect(decideLastAdmin([SELF], SELF, r, AGGLAYER_PROFILE)).toMatchObject({ message: expect.stringContaining('BRIDGE_ADMIN') });
  });
  it('warns on renouncing BRIDGE_ADMIN while others remain, and ignores renouncing other roles', () => {
    const r = bridgeRecipe({ action: 'rbac_renounce', actionArgs: { action: 'rbac_renounce', role: 'ADMIN' } });
    expectLevel(decideLastAdmin([SELF, OTHER], SELF, r, AGGLAYER_PROFILE), 'warn');
    const p = bridgeRecipe({ action: 'rbac_renounce', actionArgs: { action: 'rbac_renounce', role: 'PAUSER' } });
    expectLevel(decideLastAdmin([SELF], SELF, p, AGGLAYER_PROFILE), 'ok');
  });
  it('blocks revoking the last BRIDGE_ADMIN with the bridge wording', () => {
    const r = bridgeRecipe({ actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: OTHER } });
    expect(decideLastAdmin([OTHER], SELF, r, AGGLAYER_PROFILE)).toMatchObject({ level: 'block', message: expect.stringContaining('bridge') });
  });
  it('USDCx wording still says ADMIN and faucet', () => {
    const r = recipe({ actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: OTHER } });
    expect(decideLastAdmin([OTHER], SELF, r, USDCX_PROFILE)).toMatchObject({ level: 'block', message: expect.stringContaining('faucet') });
  });
  it('warns when an ADMIN grant and an ADMIN revoke/renounce are in flight together', () => {
    const grant = bridgeRecipe({ action: 'rbac_grant', actionArgs: { action: 'rbac_grant', role: 'ADMIN', accountId: OTHER } });
    const revoke = bridgeRecipe({ actionArgs: { action: 'rbac_revoke', role: 'ADMIN', accountId: OTHER } });
    const renounce = bridgeRecipe({ action: 'rbac_renounce', actionArgs: { action: 'rbac_renounce', role: 'ADMIN' } });
    expectLevel(decideAdminChurnInFlight(grant, [revoke]), 'warn');
    expectLevel(decideAdminChurnInFlight(revoke, [grant]), 'warn');
    expectLevel(decideAdminChurnInFlight(renounce, [grant]), 'warn');
    expectLevel(decideAdminChurnInFlight(grant, [grant]), 'ok');
    const pauserGrant = bridgeRecipe({ action: 'rbac_grant', actionArgs: { action: 'rbac_grant', role: 'PAUSER', accountId: OTHER } });
    expectLevel(decideAdminChurnInFlight(pauserGrant, [revoke]), 'ok');
    // Not a USDCx rule.
    expectLevel(decideAdminChurnInFlight(recipe({ action: 'rbac_grant', actionArgs: { action: 'rbac_grant', role: 'ADMIN', accountId: OTHER } }), [recipe()]), 'ok');
  });
});
```

Update the existing `decideLastAdmin` calls in the file to pass `USDCX_PROFILE` as the fourth argument.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/guardrails.test.ts 2>&1 | grep -E "FAIL|Tests "`
Expected: FAIL.

- [ ] **Step 3: Implement** in `src/lib/admin/guardrails.ts`

Add imports `import { recipeTarget } from '@/lib/admin/recipe'; import { roleLabel, type AdminTargetProfile } from '@/lib/admin/target';`.

Replace `decideLastAdmin` with:

```ts
/**
 * Last-ADMIN guardrail: an `rbac_revoke` of `ADMIN`, or an `rbac_renounce` of `ADMIN` by the acting
 * account, must not empty the root role (a permanent, unrecoverable lockout; the bridge spec:
 * "BRIDGE_ADMIN must never be emptied"). Short of that, `warn`s when the acting account is the one
 * losing ADMIN. Pure: callers fetch `adminMembers` via `rbac_role_members(bytes, 'ADMIN')`.
 */
export function decideLastAdmin(
  adminMembers: string[],
  actingAccountId: string,
  recipe: AdminRecipe,
  target: AdminTargetProfile,
): GuardrailResult {
  const args = recipe.actionArgs;
  let losing: string;
  if (args.action === 'rbac_revoke' && args.role === 'ADMIN') losing = args.accountId;
  else if (args.action === 'rbac_renounce' && args.role === 'ADMIN') losing = actingAccountId;
  else return OK;

  const admin = roleLabel(target, 'ADMIN');
  const noun = target.labels.contractNoun;
  const remaining = adminMembers.filter((member) => !sameAccount(member, losing));
  if (remaining.length === 0) {
    return {
      level: 'block',
      message: `This would remove the last ${admin} on this ${noun}, permanently locking out administration. The chain does not prevent this -- it cannot be undone.`,
    };
  }
  if (sameAccount(losing, actingAccountId)) {
    return {
      level: 'warn',
      message: `This removes ${admin} from the account you are acting as. Other ${admin}s remain, but you may lose the ability to manage this ${noun} from this account.`,
    };
  }
  return OK;
}
```

Add:

```ts
/**
 * Bridge-only: the order in which pending notes are consumed is not under the operator's control,
 * so an ADMIN grant and an ADMIN revoke/renounce must not be in flight at the same time (the
 * revoke could land first and leave the grant unauthorised, or the reverse). `warn`s; never blocks.
 */
export function decideAdminChurnInFlight(recipe: AdminRecipe, inflightRecipes: AdminRecipe[]): GuardrailResult {
  if (recipeTarget(recipe) !== 'agglayer') return OK;
  const kind = (r: AdminRecipe): 'grant' | 'remove' | null => {
    const a = r.actionArgs;
    if (a.action === 'rbac_grant' && a.role === 'ADMIN') return 'grant';
    if ((a.action === 'rbac_revoke' || a.action === 'rbac_renounce') && a.role === 'ADMIN') return 'remove';
    return null;
  };
  const mine = kind(recipe);
  if (!mine) return OK;
  const opposite = mine === 'grant' ? 'remove' : 'grant';
  if (inflightRecipes.some((r) => recipeTarget(r) === 'agglayer' && kind(r) === opposite)) {
    return {
      level: 'warn',
      message:
        'A BRIDGE_ADMIN grant and a BRIDGE_ADMIN revoke/renounce would be in flight at the same time. The bridge consumes pending notes in any order; wait for the other proposal to land first.',
    };
  }
  return OK;
}
```

Replace `runGuardrails` with:

```ts
export async function runGuardrails(
  contractBytes: Uint8Array,
  target: AdminTargetProfile,
  recipe: AdminRecipe,
  inflightRecipes: AdminRecipe[],
): Promise<GuardrailResult> {
  await initAdminWasm();
  const adminMembers = rbac_role_members(contractBytes, 'ADMIN');
  return mostSevere([
    decideLastAdmin(adminMembers, recipe.senderAccountId, recipe, target),
    decideRoleSeparation(recipe, recipe.senderAccountId),
    decideRevokeInFlight(recipe, inflightRecipes),
    decideAdminChurnInFlight(recipe, inflightRecipes),
  ]);
}
```

(`decideRoleSeparation` matches `DOM_PAUSER`/`BLK_MANAGER` by name, which no bridge role carries, so it needs no target parameter.)

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/guardrails.test.ts 2>&1 | grep -E "Tests "`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/guardrails.ts tests/admin/guardrails.test.ts
git commit -m "feat(admin): guardrails know the target; never empty BRIDGE_ADMIN; warn on admin churn in flight"
```

---

### Task 8: Target evaluation hook, selection rule and context

**Files:**
- Create: `src/lib/admin/targetSelection.ts`, `src/hooks/useAdminTargets.ts`, `src/contexts/AdminTargetContext.tsx`
- Modify: `src/app/dashboard/layout.tsx` (wrap `DashboardShell` in the provider when `isAdminMode`)
- Delete: `src/hooks/useFaucetRoles.ts`, `src/hooks/useFaucetAccountBytes.ts` (their callers move to the context in Task 9; keep the `FaucetBytesState` type by re-exporting it from the new hook)
- Test: `tests/admin/targetSelection.test.ts`

**Interfaces (produces):**

```ts
// targetSelection.ts
export interface TargetEvaluation {
  target: AdminTarget;
  status: 'ready' | 'error';
  bytes?: Uint8Array;           // ready only
  roles: RoleFlags | null;      // acting multisig; null when none loaded
  breadRoles: RoleFlags | null; // Bread account; null when not active
  breadAccountId: string | null;
  message?: string;             // error only
}
export function selectActiveTarget(evaluations: readonly TargetEvaluation[], remembered: AdminTargetKind | null): AdminTargetKind | null;
export function targetsWithRoles(evaluations: readonly TargetEvaluation[]): AdminTargetKind[];
// useAdminTargets.ts
export type FaucetBytesState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; bytes: Uint8Array };
export type AdminTargetsState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; evaluations: TargetEvaluation[] };
export function useAdminTargets(): AdminTargetsState;
export function bytesStateOf(e: TargetEvaluation | null, state: AdminTargetsState): FaucetBytesState;
// AdminTargetContext.tsx
export interface AdminTargetContextValue {
  state: AdminTargetsState;
  configured: AdminTarget[];               // getAdminTargets()
  activeKind: AdminTargetKind | null;
  active: TargetEvaluation | null;         // evaluation of activeKind, when ready
  switchable: AdminTargetKind[];           // targets where someone holds a role (switcher shown when > 1)
  setActiveKind: (kind: AdminTargetKind) => void;
  refresh: () => void;
}
export function AdminTargetProvider({ children }): JSX.Element;
export function useAdminTarget(): AdminTargetContextValue;
```

- [ ] **Step 1: Write the failing test** `tests/admin/targetSelection.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { selectActiveTarget, targetsWithRoles, type TargetEvaluation } from '@/lib/admin/targetSelection';
import { AGGLAYER_PROFILE, USDCX_PROFILE, type AdminTarget } from '@/lib/admin/target';

const usdcx: AdminTarget = { ...USDCX_PROFILE, contractId: '0xa', feeFaucetId: '0xfee', networkId: 'testnet' };
const bridge: AdminTarget = { ...AGGLAYER_PROFILE, contractId: '0xb', feeFaucetId: '0xfee', networkId: 'testnet' };
const ready = (target: AdminTarget, roles: Record<string, boolean> | null, breadRoles: Record<string, boolean> | null = null): TargetEvaluation =>
  ({ target, status: 'ready', bytes: new Uint8Array(), roles, breadRoles, breadAccountId: breadRoles ? '0xbread' : null });
const failed = (target: AdminTarget): TargetEvaluation => ({ target, status: 'error', roles: null, breadRoles: null, breadAccountId: null, message: 'account not found' });

describe('selectActiveTarget', () => {
  it('picks the single target where anyone holds a role', () => {
    expect(selectActiveTarget([ready(usdcx, { ADMIN: false }), ready(bridge, { ADMIN: true })], null)).toBe('agglayer');
    expect(selectActiveTarget([ready(usdcx, null, { DOM_PAUSER: true }), ready(bridge, { ADMIN: false })], null)).toBe('usdcx');
  });
  it('honours the remembered choice only when it holds roles, else the first with roles', () => {
    const both = [ready(usdcx, { ADMIN: true }), ready(bridge, { ADMIN: true })];
    expect(selectActiveTarget(both, 'agglayer')).toBe('agglayer');
    expect(selectActiveTarget(both, null)).toBe('usdcx');
    expect(selectActiveTarget([ready(usdcx, { ADMIN: true }), ready(bridge, { ADMIN: false })], 'agglayer')).toBe('usdcx');
    expect(targetsWithRoles(both)).toEqual(['usdcx', 'agglayer']);
  });
  it('is null when nobody holds a role anywhere', () => {
    expect(selectActiveTarget([ready(usdcx, { ADMIN: false }), ready(bridge, null)], 'usdcx')).toBeNull();
    expect(selectActiveTarget([], null)).toBeNull();
  });
  it('skips a target the node could not serve, so the other console still works', () => {
    expect(selectActiveTarget([failed(usdcx), ready(bridge, { PAUSER: true })], 'usdcx')).toBe('agglayer');
    expect(selectActiveTarget([failed(usdcx), ready(bridge, { PAUSER: false })], null)).toBeNull();
  });
  it('with one configured target and no roles, still returns null (the page explains)', () => {
    expect(selectActiveTarget([ready(usdcx, { ADMIN: false })], null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/targetSelection.test.ts 2>&1 | tail -4`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/lib/admin/targetSelection.ts`:

```ts
import type { AdminTarget, AdminTargetKind } from '@/lib/admin/target';
import { holdsAnyRole, type RoleFlags } from '@/lib/admin/roles';

/** One configured target, read from the node and evaluated for the two possible actors. */
export interface TargetEvaluation {
  target: AdminTarget;
  status: 'ready' | 'error';
  /** The contract's serialized `Account` bytes (ready only). */
  bytes?: Uint8Array;
  /** Roles of the acting multisig; `null` when no multisig is loaded. */
  roles: RoleFlags | null;
  /** Roles of the account connected through Bread; `null` when Bread is not the active source. */
  breadRoles: RoleFlags | null;
  breadAccountId: string | null;
  /** Why the read failed (error only). Never treated as "no roles". */
  message?: string;
}

export function evaluationHasRoles(e: TargetEvaluation): boolean {
  return e.status === 'ready' && (holdsAnyRole(e.roles) || holdsAnyRole(e.breadRoles));
}

/** The kinds where the multisig or Bread holds at least one role, in configured order. */
export function targetsWithRoles(evaluations: readonly TargetEvaluation[]): AdminTargetKind[] {
  return evaluations.filter(evaluationHasRoles).map((e) => e.target.kind);
}

/**
 * Which console to show: the one target where someone holds a role; with several, the remembered
 * choice if it still qualifies, else the first; none when nobody holds a role anywhere.
 */
export function selectActiveTarget(evaluations: readonly TargetEvaluation[], remembered: AdminTargetKind | null): AdminTargetKind | null {
  const candidates = targetsWithRoles(evaluations);
  if (candidates.length === 0) return null;
  if (remembered && candidates.includes(remembered)) return remembered;
  return candidates[0];
}
```

`src/hooks/useAdminTargets.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMultisig } from '@/contexts/MultisigContext';
import { getAdminTargets } from '@/config/adminConfig';
import { initAdminWasm } from '@/lib/admin/noteBuilders';
import { accountIdHexFromBech32 } from '@/lib/admin/directAction';
import { evaluateRoles } from '@/lib/admin/roles';
import { fetchFaucetBytes } from '@/lib/admin/faucetAccount';
import type { TargetEvaluation } from '@/lib/admin/targetSelection';

/** The per-target contract bytes, as the forms and guardrails consume them. */
export type FaucetBytesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; bytes: Uint8Array };

export type AdminTargetsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; evaluations: TargetEvaluation[] };

/**
 * Reads every configured contract from the node and evaluates the roles of the acting multisig
 * and, when Bread is the active wallet source, of the Bread account. One target failing (private,
 * missing, RPC error) is reported on that target only; it never degrades to "no roles".
 * `idle` while there is nobody to evaluate.
 */
export function useAdminTargets(): { state: AdminTargetsState; refresh: () => void } {
  const { midenClient, multisig, walletSource, midenWalletSession } = useMultisig();
  const [state, setState] = useState<AdminTargetsState>({ status: 'idle' });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const breadAddress =
    walletSource === 'miden-wallet' && midenWalletSession.connected ? (midenWalletSession.address ?? null) : null;

  useEffect(() => {
    if (!midenClient || (!multisig && !breadAddress)) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      await initAdminWasm();
      const breadAccountId = breadAddress ? accountIdHexFromBech32(breadAddress) : null;
      const evaluations = await Promise.all(
        getAdminTargets().map(async (target): Promise<TargetEvaluation> => {
          try {
            const bytes = await fetchFaucetBytes(midenClient, target.contractId);
            return {
              target,
              status: 'ready',
              bytes,
              roles: multisig ? evaluateRoles(bytes, multisig.account.id().toString(), target) : null,
              breadRoles: breadAccountId ? evaluateRoles(bytes, breadAccountId, target) : null,
              breadAccountId,
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { target, status: 'error', roles: null, breadRoles: null, breadAccountId, message: `Could not read the ${target.labels.contractNoun}: ${message}` };
          }
        }),
      );
      if (!cancelled) setState({ status: 'ready', evaluations });
    })().catch((err) => {
      // initAdminWasm or bech32 parsing failed: every target is unreadable.
      if (cancelled) return;
      const message = err instanceof Error ? err.message : String(err);
      setState({
        status: 'ready',
        evaluations: getAdminTargets().map((target) => ({ target, status: 'error', roles: null, breadRoles: null, breadAccountId: null, message })),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [midenClient, multisig, breadAddress, tick]);

  return { state, refresh };
}

/** The active target's bytes in the shape the action forms and guardrails take. */
export function bytesStateOf(active: TargetEvaluation | null, state: AdminTargetsState): FaucetBytesState {
  if (state.status !== 'ready' || !active) return { status: 'loading' };
  if (active.status === 'error') return { status: 'error', message: active.message ?? 'unreadable' };
  return { status: 'ready', bytes: active.bytes! };
}
```

`src/contexts/AdminTargetContext.tsx`:

```tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMultisig } from '@/contexts/MultisigContext';
import { getAdminTargets } from '@/config/adminConfig';
import type { AdminTarget, AdminTargetKind } from '@/lib/admin/target';
import { selectActiveTarget, targetsWithRoles, type TargetEvaluation } from '@/lib/admin/targetSelection';
import { useAdminTargets, type AdminTargetsState } from '@/hooks/useAdminTargets';

export interface AdminTargetContextValue {
  state: AdminTargetsState;
  configured: AdminTarget[];
  activeKind: AdminTargetKind | null;
  active: TargetEvaluation | null;
  switchable: AdminTargetKind[];
  setActiveKind: (kind: AdminTargetKind) => void;
  refresh: () => void;
}

const Ctx = createContext<AdminTargetContextValue | null>(null);

const storageKey = (accountId: string | null) => `adminTarget:${(accountId ?? 'none').toLowerCase()}`;

function readRemembered(accountId: string | null): AdminTargetKind | null {
  try {
    const v = window.localStorage.getItem(storageKey(accountId));
    return v === 'usdcx' || v === 'agglayer' ? v : null;
  } catch {
    return null;
  }
}

/** Which contract the console administers right now; see `selectActiveTarget` for the rule. */
export function AdminTargetProvider({ children }: { children: ReactNode }) {
  const { multisig } = useMultisig();
  const { state, refresh } = useAdminTargets();
  const accountId = multisig?.accountId ?? null;
  const [remembered, setRemembered] = useState<AdminTargetKind | null>(null);
  useEffect(() => setRemembered(readRemembered(accountId)), [accountId]);

  const evaluations = state.status === 'ready' ? state.evaluations : [];
  const activeKind = useMemo(() => selectActiveTarget(evaluations, remembered), [evaluations, remembered]);
  const switchable = useMemo(() => targetsWithRoles(evaluations), [evaluations]);
  const active = evaluations.find((e) => e.target.kind === activeKind) ?? null;

  const setActiveKind = useCallback(
    (kind: AdminTargetKind) => {
      setRemembered(kind);
      try {
        window.localStorage.setItem(storageKey(accountId), kind);
      } catch {
        /* per-browser convenience only */
      }
    },
    [accountId],
  );

  const value = useMemo<AdminTargetContextValue>(
    () => ({ state, configured: getAdminTargets(), activeKind, active, switchable, setActiveKind, refresh }),
    [state, activeKind, active, switchable, setActiveKind, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminTarget(): AdminTargetContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdminTarget must be used inside AdminTargetProvider (admin mode only)');
  return v;
}
```

In `src/app/dashboard/layout.tsx`, import the provider and change `Layout` to:

```tsx
  return (
    <DashboardUIProvider>
      {isAdminMode ? (
        <AdminTargetProvider>
          <DashboardShell>{children}</DashboardShell>
        </AdminTargetProvider>
      ) : (
        <DashboardShell>{children}</DashboardShell>
      )}
    </DashboardUIProvider>
  );
```

Delete `src/hooks/useFaucetRoles.ts` and `src/hooks/useFaucetAccountBytes.ts`; update every `import type { FaucetBytesState } from '@/hooks/useFaucetAccountBytes'` to `'@/hooks/useAdminTargets'` (files: `AdminActionCard.tsx`, `RbacForms.tsx`, `PauseForms.tsx`, `AttesterForm.tsx`, `BlocklistForm.tsx`, `SupplyBurnFeeForms.tsx`, `FaucetStateCard.tsx`, `useFaucetConfig.ts`, `admin/page.tsx`).

- [ ] **Step 4: Run the test and typecheck**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/targetSelection.test.ts 2>&1 | grep -E "Tests " && npm run -s typecheck 2>&1 | grep -v "admin/page.tsx\|roles/page.tsx\|AdminBanner\|LockedActionCard\|RbacForms\|PauseForms" | head`
Expected: tests pass; the only remaining type errors are in the files Task 9 rewrites.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/targetSelection.ts src/hooks/useAdminTargets.ts src/contexts/AdminTargetContext.tsx src/app/dashboard/layout.tsx tests/admin/targetSelection.test.ts
git rm -q src/hooks/useFaucetRoles.ts src/hooks/useFaucetAccountBytes.ts
git add -u src
git commit -m "feat(admin): evaluate roles on every configured contract; active-target context and selection rule"
```

---

### Task 9a: Shared action components read the active target

**Files:**
- Modify: `src/app/dashboard/admin/components/AdminActionCard.tsx`, `LockedActionCard.tsx`, `RbacForms.tsx`, `PauseForms.tsx`
- Create: `src/components/admin/AdminTargetSwitcher.tsx`

No new unit tests (component rendering has no harness in this repo); correctness is pinned by `tsc`, the Task 6/7 tests on the pure functions these call, and the live check in Task 11.

- [ ] **Step 1: AdminActionCard**

Add `import { useAdminTarget } from '@/contexts/AdminTargetContext';` and remove the `getAdminConfig` import. Inside the component, after `useMultisig()`: `const { active } = useAdminTarget();`. Replace the draft recipe construction:

```ts
    if (!active) {
      setFieldError('No admin target is active');
      return;
    }
    const target = active.target;
    const draft: AdminRecipe = {
      recipeVersion: 1,
      target: target.kind,
      action,
      actionArgs,
      senderAccountId,
      faucetId: target.contractId,
      feeFaucetId: target.feeFaucetId,
      networkId: target.networkId,
      saltHex: '',
      boundBlockNum: 0,
    };
```

and the guardrail call: `runGuardrails(faucetBytesState.bytes, target, draft, inflightRecipes)`. In the "Bread submitted" toast replace `The faucet applies it` with `` The ${target.labels.contractNoun} applies it ``.

- [ ] **Step 2: LockedActionCard**

```tsx
'use client';

import type { AdminAction } from '@/lib/admin/recipe';
import { actionInfo } from '@/lib/admin/roles';
import { ANY_HELD_ROLE, actionRoleOf, roleLabel, type AdminTargetProfile } from '@/lib/admin/target';

export function LockedActionCard({ action, target }: { action: AdminAction; target: AdminTargetProfile }) {
  const info = actionInfo(target, action);
  const gate = actionRoleOf(target, action);
  const requirement = gate === ANY_HELD_ROLE ? 'any role on this contract' : gate ? `the ${roleLabel(target, gate)} role` : 'a role this target does not grant';
  // ...same markup as before; replace the trailing line with:
  //   Requires <span className="font-mono">{requirement}</span>
}
```

(keep the existing JSX; only the two computed values and the prop change.)

- [ ] **Step 3: RbacForms**

Rewrite the file: `RoleSelect` takes `roles: readonly RoleSpec[]` and renders `<option value={r.symbol}>{r.label}</option>`; every form reads `const { active } = useAdminTarget(); const target = active!.target;` (forms only render when a sender resolved, so `active` is set) and uses `actionInfo(target, action)` for title/description and `target.networkId` for `normalizeAccountId`. Add two forms:

```tsx
/** ADMIN-gated: change which role administers `role`. */
export function RbacSetAdminForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const { active } = useAdminTarget();
  const target = active!.target;
  const [role, setRole] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const info = actionInfo(target, 'rbac_set_admin');
  return (
    <AdminActionCard action="rbac_set_admin" title={info.title} description={info.description}
      faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} sender={sender}
      buildArgs={() => {
        if (!role) throw new ValidationError('Select a role');
        return { action: 'rbac_set_admin', role, adminRole: adminRole || null };
      }}
      onSubmitted={() => { setRole(''); setAdminRole(''); }}>
      <Field label="Role"><RoleSelect roles={target.roles} value={role} onChange={setRole} /></Field>
      <Field label="Admin role (empty = default root admin)"><RoleSelect roles={target.roles} value={adminRole} onChange={setAdminRole} /></Field>
    </AdminActionCard>
  );
}

/** Open to any role holder: give up a role the sender holds. The select lists only those. */
export function RbacRenounceForm({ faucetBytesState, inflightRecipes, sender }: GroupProps) {
  const { active } = useAdminTarget();
  const target = active!.target;
  const flags = sender === 'bread' ? active!.breadRoles : active!.roles;
  const held = target.roles.filter((r) => flags?.[r.symbol]);
  const [role, setRole] = useState('');
  const info = actionInfo(target, 'rbac_renounce');
  return (
    <AdminActionCard action="rbac_renounce" title={info.title} description={info.description}
      faucetBytesState={faucetBytesState} inflightRecipes={inflightRecipes} sender={sender}
      buildArgs={() => {
        if (!role) throw new ValidationError('Select a role you hold');
        return { action: 'rbac_renounce', role };
      }}
      onSubmitted={() => setRole('')} submitLabel="Renounce">
      <Field label="Role to renounce"><RoleSelect roles={held} value={role} onChange={setRole} /></Field>
    </AdminActionCard>
  );
}
```

Imports: `useState`, `AdminActionCard`, `Field`, `AccountIdField`, `selectClass`, `normalizeAccountId`, `ValidationError`, `useAdminTarget`, `actionInfo`, `type RoleSpec`, `type AdminRecipe`, `type ActionSender`, `type FaucetBytesState` (from `@/hooks/useAdminTargets`).

- [ ] **Step 4: PauseForms**

Read `const { active } = useAdminTarget(); const target = active!.target;`, use `actionInfo(target, 'pause'|'unpause')` for title/description, and the helper text `No inputs required -- review and confirm to {sender === 'bread' ? 'send' : 'propose'} {verb} the {target.labels.contractNoun}.` with verb `pausing` / `unpausing`.

- [ ] **Step 5: AdminTargetSwitcher** (`src/components/admin/AdminTargetSwitcher.tsx`)

```tsx
'use client';

import { useAdminTarget } from '@/contexts/AdminTargetContext';
import { profileOf } from '@/lib/admin/target';

/** USDCx / AggLayer chips; rendered only when the acting accounts hold roles on more than one contract. */
export function AdminTargetSwitcher() {
  const { switchable, activeKind, setActiveKind } = useAdminTarget();
  if (switchable.length < 2) return null;
  return (
    <div className="flex items-center gap-1 rounded-full border border-[rgba(0,0,0,0.12)] p-0.5" role="tablist" aria-label="Admin console">
      {switchable.map((kind) => (
        <button key={kind} type="button" role="tab" aria-selected={kind === activeKind} onClick={() => setActiveKind(kind)}
          className={`text-[11px] font-[500] px-2.5 py-1 rounded-full transition-colors ${kind === activeKind ? 'bg-[#FF5500] text-white' : 'text-[#111] hover:bg-[#FF5500]/10'}`}>
          {profileOf(kind).labels.contractShort}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck and commit**

Run: `npm run -s typecheck 2>&1 | head` — expected errors only in `admin/page.tsx`, `roles/page.tsx`, `AdminBanner.tsx` (Task 9b).

```bash
git add src/app/dashboard/admin/components src/components/admin/AdminTargetSwitcher.tsx
git commit -m "feat(admin): action cards, RBAC and pause forms read the active target; set-admin and renounce forms"
```

---

### Task 9b: Admin page, roles page, banner and bridge state card

**Files:**
- Modify: `src/app/dashboard/admin/page.tsx`, `src/app/dashboard/admin/roles/page.tsx`, `src/components/admin/AdminBanner.tsx`
- Create: `src/app/dashboard/admin/components/BridgeStateCard.tsx`, `src/hooks/useBridgeState.ts`
- Modify: `src/lib/admin/noteBuilders.ts` (add `readIsPaused`)

- [ ] **Step 1: `readIsPaused`** in `noteBuilders.ts`, after `readEnabledAttesters`:

```ts
/** Whether the contract (faucet or bridge) is paused, from its serialized account bytes. */
export function readIsPaused(contractBytes: Uint8Array): boolean {
  return wasm.is_paused(contractBytes);
}
```

Add to `tests/admin/noteBuilders.test.ts` (the wasm is initialised in `beforeAll`): a smoke test that `readIsPaused` returns `false` on... there are no serialized account bytes in TS fixtures, so assert only the export: `expect(typeof readIsPaused).toBe('function')`. The reader itself is proven in Task 2.

- [ ] **Step 2: `useBridgeState`** (`src/hooks/useBridgeState.ts`)

```ts
'use client';

import { useEffect, useState } from 'react';
import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { initAdminWasm, readIsPaused } from '@/lib/admin/noteBuilders';
import { listRoleHolders } from '@/lib/admin/roles';
import type { AdminTargetProfile } from '@/lib/admin/target';

export interface BridgeState {
  paused: boolean;
  /** Holder count per on-chain role symbol. */
  holderCounts: Record<string, number>;
}

/** The bridge's paused flag and role holder counts from its account bytes; `null` until readable. */
export function useBridgeState(state: FaucetBytesState, target: AdminTargetProfile): BridgeState | null {
  const [value, setValue] = useState<BridgeState | null>(null);
  useEffect(() => {
    if (state.status !== 'ready') { setValue(null); return; }
    let cancelled = false;
    (async () => {
      try {
        await initAdminWasm();
        const holders = listRoleHolders(state.bytes, target);
        const holderCounts = Object.fromEntries(Object.entries(holders).map(([role, ids]) => [role, ids.length]));
        if (!cancelled) setValue({ paused: readIsPaused(state.bytes), holderCounts });
      } catch {
        if (!cancelled) setValue(null);
      }
    })();
    return () => { cancelled = true; };
  }, [state, target]);
  return value;
}
```

- [ ] **Step 3: `BridgeStateCard`** (`src/app/dashboard/admin/components/BridgeStateCard.tsx`)

```tsx
'use client';

import type { FaucetBytesState } from '@/hooks/useAdminTargets';
import { useBridgeState } from '@/hooks/useBridgeState';
import type { AdminTargetProfile } from '@/lib/admin/target';

/** Paused flag and holder counts for the bridge, at the top of the AggLayer console. */
export function BridgeStateCard({ faucetBytesState, target }: { faucetBytesState: FaucetBytesState; target: AdminTargetProfile }) {
  const state = useBridgeState(faucetBytesState, target);
  if (!state) return null;
  return (
    <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white">
      <div className="text-[14px] font-[600] text-[#111] mb-0.5">Bridge state</div>
      <div className="text-[12px] text-[rgba(0,0,0,0.5)] mb-3">Current on-chain values.</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-[#f9f9f9] px-3 py-2.5">
          <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.5)]">Status</div>
          <div className={`text-[14px] font-[600] mt-0.5 ${state.paused ? 'text-red-700' : 'text-[#1F7A3F]'}`}>{state.paused ? 'Paused' : 'Running'}</div>
        </div>
        {target.roles.map((role) => (
          <div key={role.symbol} className="rounded-[8px] border border-[rgba(0,0,0,0.06)] bg-[#f9f9f9] px-3 py-2.5">
            <div className="text-[11px] font-[500] text-[rgba(0,0,0,0.5)] font-mono">{role.label}</div>
            <div className="text-[14px] font-[600] text-[#111] mt-0.5">{state.holderCounts[role.symbol] ?? 0} holder{(state.holderCounts[role.symbol] ?? 0) === 1 ? '' : 's'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Admin page**

Replace the body of `src/app/dashboard/admin/page.tsx` so it reads the context. Keep the existing JSX blocks (banner, funding card, loading spinner, error, "no roles", grid, proposal list) and change the data flow:

```tsx
import { useAdminTarget } from '@/contexts/AdminTargetContext';
import { bytesStateOf } from '@/hooks/useAdminTargets';
import { actionRoleOf, type AdminTarget } from '@/lib/admin/target';
import { BridgeStateCard } from './components/BridgeStateCard';
import { RbacGrantForm, RbacRevokeForm, RbacSetAdminForm, RbacRenounceForm } from './components/RbacForms';
// ...
const FORM_OF: Record<AdminAction, ComponentType<ActionFormProps>> = {
  set_max_supply: SetMaxSupplyForm, set_min_burn: SetMinBurnForm, set_note_fee: SetNoteFeeForm,
  rbac_grant: RbacGrantForm, rbac_revoke: RbacRevokeForm, rbac_set_admin: RbacSetAdminForm, rbac_renounce: RbacRenounceForm,
  set_attester: SetAttesterForm, pause: PauseForm, unpause: UnpauseForm, blocklist: BlocklistForm,
};

export default function AdminPage() {
  const { proposals, multisig, walletSource, midenWalletSession } = useMultisig();
  const { state, configured, active, activeKind } = useAdminTarget();
  const faucetBytesState = bytesStateOf(active, state);
  const inflightRecipes = useMemo(/* unchanged */);
  if (!isAdminMode) { /* unchanged */ }

  const breadConnected = walletSource === 'miden-wallet' && midenWalletSession.connected;
  const anyone = multisig !== null || breadConnected;
  const rolesKnown = anyone && state.status === 'ready';
  const target: AdminTarget | null = active?.target ?? null;
  const senderFor = (action: AdminAction): ActionSender | null =>
    active && active.status === 'ready' ? resolveActionSender(action, active.target, active.roles, active.breadRoles) : null;
  const canAct = (action: AdminAction) => senderFor(action) !== null;
  const actions = target ? [...target.actions].sort((a, b) => Number(canAct(b)) - Number(canAct(a))) : [];
  const failed = state.status === 'ready' ? state.evaluations.filter((e) => e.status === 'error') : [];
  const showActions = rolesKnown && target !== null;
```

Render, in order: `<AdminBanner />`, `<AdminFundingCard />`, then `target?.kind === 'usdcx' ? <FaucetStateCard faucetBytesState={faucetBytesState} /> : target?.kind === 'agglayer' ? <BridgeStateCard faucetBytesState={faucetBytesState} target={target} /> : null`; the unchanged "no multisig" and "loading" blocks (loading = `state.status === 'loading'`); one `role="alert"` block per `failed` evaluation showing `e.message`; when `rolesKnown && !activeKind` a "no admin roles" block:

```tsx
  <div className="rounded-[10px] border border-[rgba(0,0,0,0.08)] p-4 md:p-5 bg-white text-[13px] text-[rgba(0,0,0,0.6)]">
    {configured.length === 0
      ? 'No contract is configured for this console (NEXT_PUBLIC_USDCX_FAUCET_ID / NEXT_PUBLIC_AGGLAYER_BRIDGE_ID).'
      : `Neither the acting multisig nor the connected Bread account holds a role on ${configured.map((t) => `the ${t.labels.contractNoun} (${t.contractId})`).join(' or ')}. The Roles page shows who does.`}
  </div>
```

the action grid over `actions` with `const Form = FORM_OF[action]; const sender = senderFor(action);` rendering `<Form … sender={sender}/>` or `<LockedActionCard key={action} action={action} target={target} />`; and `{rolesKnown && multisig && <AdminProposalList proposals={proposals} />}`. Remove `actionRoleOf` from the import if unused.

- [ ] **Step 5: Roles page**

`RoleHolders` takes `{ target, bytesState }` props: `listRoleHolders(bytesState.bytes, target)`, iterates `target.roles` (label shown, `symbol` used for lookups), `actionsOfRole(target, role.symbol).map((a) => actionLabel(target, a).toLowerCase())`. The page:

```tsx
export default function AdminRolesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { state, configured, active, activeKind, setActiveKind, refresh } = useAdminTarget();
  const [inspect, setInspect] = useState<AdminTargetKind | null>(null);
  const kind = inspect ?? activeKind ?? configured[0]?.kind ?? null;
  const target = configured.find((t) => t.kind === kind) ?? null;
  const evaluation = state.status === 'ready' ? state.evaluations.find((e) => e.target.kind === kind) ?? null : null;
  const bytesState = bytesStateOf(evaluation, state);
  // header card: `Roles on the ${target.labels.contractNoun}`; contract id + network; a <select> over
  // `configured` (when > 1) bound to `kind` -> setInspect (and setActiveKind when it is switchable);
  // Refresh = refresh() + setRefreshKey; for agglayer add the note:
  //   "FAUCET_ADMIN is not a bridge role: each bridged-token faucet carries its own ADMIN role."
  // body: target ? <RoleHolders key={refreshKey} target={target} bytesState={bytesState} /> : "not configured"
}
```

- [ ] **Step 6: Banner**

`AdminBanner` reads `useAdminTarget()`: title `active?.target.labels.consoleTitle ?? 'Admin Console'`, the switcher `<AdminTargetSwitcher />` on the title row's right, the contract column labelled with `target.labels.contractNoun` and showing `shortFaucetId(target.contractId)`, roles rendered through `roleLabel(target, symbol)` for `Object.entries(flags).filter(([, v]) => v)`, loading when `state.status === 'loading'`, the `error` treatment when `active?.status === 'error'`, and the existing Bread-inactive hint. When `activeKind` is null and `state.status === 'ready'`, the roles rows read "No admin roles are held on any configured contract."

- [ ] **Step 7: Verify**

Run: `npm run -s typecheck && npx next lint --dir src --dir tests 2>&1 | grep -c "Error:" ; npm run -s test:admin 2>&1 | grep -E "Test Files|Tests "`
Expected: typecheck clean, 0 lint errors, all admin tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/admin src/components/admin/AdminBanner.tsx src/hooks/useBridgeState.ts src/lib/admin/noteBuilders.ts tests/admin/noteBuilders.test.ts
git commit -m "feat(admin): AggLayer console screens; admin and roles pages follow the active target"
```

---

### Task 10: History annotation and proposal labels across both contracts

**Files:**
- Modify: `src/lib/history/annotate.ts`, `src/hooks/useOnChainHistory.ts` (`targetTags`), `src/contexts/MultisigContext.tsx` (one string, line ~1280)
- Test: `tests/admin/history.test.ts` (`classifyNote` describe)

**Interfaces (produces):** `export interface TargetTags { faucetTag: number | null; bridgeTag: number | null; feeFaucetTag: number | null }`; `classifyNote` returns `'admin'` for either contract tag.

- [ ] **Step 1: Write the failing test** (in the `classifyNote` describe of `tests/admin/history.test.ts`)

```ts
  it('classifies notes to the bridge as admin notes too', () => {
    const last = records[records.length - 1] /* decoded */;
    const admin = last.outputNotes.find((n) => classifyNote(n, { faucetTag: account_target_tag(FAUCET), bridgeTag: null, feeFaucetTag: null }) === 'admin')!;
    // Pretend the faucet were the bridge: the same tag under `bridgeTag` classifies identically.
    expect(classifyNote(admin, { faucetTag: null, bridgeTag: account_target_tag(FAUCET), feeFaucetTag: null })).toBe('admin');
    expect(classifyNote(admin, { faucetTag: null, bridgeTag: null, feeFaucetTag: null })).toBe('other');
  });
```

and add `bridgeTag: null` to the two existing `tags` literals in that describe. Use the same `records`/decode path the describe already uses for `last`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config vitest.admin.config.ts tests/admin/history.test.ts 2>&1 | grep -E "FAIL|Tests "`
Expected: type error on `bridgeTag`.

- [ ] **Step 3: Implement**

`annotate.ts`:

```ts
export interface TargetTags {
  /** `NoteTag::with_account_target(contract)` as u32, or null when that contract is not configured. */
  faucetTag: number | null;
  bridgeTag: number | null;
  feeFaucetTag: number | null;
}

export function classifyNote(note: OnChainNote, tags: TargetTags): NoteRole {
  const isContract = (tags.faucetTag !== null && note.tag === tags.faucetTag) || (tags.bridgeTag !== null && note.tag === tags.bridgeTag);
  if (isContract) return note.attachmentSchemes.some((s) => s !== 0) ? 'fee_sponsorship' : 'admin';
  if (tags.feeFaucetTag !== null && note.tag === tags.feeFaucetTag) return 'fee_payment';
  return 'other';
}

export const NOTE_ROLE_LABEL: Record<NoteRole, string> = {
  admin: 'Admin note to the administered contract',
  ...
```

`useOnChainHistory.ts` `targetTags()`: `return { faucetTag: tag(cfg.faucetId), bridgeTag: tag(cfg.bridgeId), feeFaucetTag: tag(cfg.feeFaucetId) };`. `indexKnownProposals` needs no change: `decodeRecipeLabel` already accepts both prefixes (Task 5).

`MultisigContext.tsx`: the proposal-creation label becomes `` `${profileOf(recipeTarget(recipe)).labels.contractShort} ${recipe.action}` `` (import `profileOf` from `@/lib/admin/target` and `recipeTarget` from `@/lib/admin/recipe`).

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npm run -s test:admin 2>&1 | grep -E "Test Files|Tests " && npm run -s typecheck && npx next lint --dir src --dir tests 2>&1 | grep -c "Error:"`
Expected: all pass, clean, 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/history/annotate.ts src/hooks/useOnChainHistory.ts src/contexts/MultisigContext.tsx tests/admin/history.test.ts
git commit -m "feat(history): classify admin notes to either administered contract"
```

---

### Task 11: Docs, env, CI, full verification and deploy

**Files:**
- Modify: `bin/coordinator-frontend/.env.example`, `docs/DEPLOY_VERCEL.md`, `.github/workflows/test.yml`, `tasks/todo.md`

- [ ] **Step 1: Document the variable**

`.env.example`, under the admin block: `# NEXT_PUBLIC_AGGLAYER_BRIDGE_ID=0x...     # the AggLayer bridge account; unset = USDCx-only console`.

`docs/DEPLOY_VERCEL.md`: add a row to the env table: `NEXT_PUBLIC_AGGLAYER_BRIDGE_ID` | the AggLayer bridge account id | Optional. When set, the console also administers the bridge; the console shown is the one where the connected account holds roles (a switcher appears when it holds roles on both). Replace the sentence claiming `assertAdminConfig()` is enforced at runtime with: "Each configured contract is read from the node at runtime; a missing id simply omits that contract."

`.github/workflows/test.yml`, admin build env: add `NEXT_PUBLIC_AGGLAYER_BRIDGE_ID: "0xcccccccccccccccccccccccccccccccc"` so the bridge code paths compile under `next build`.

- [ ] **Step 2: Full verification**

From the worktree root:

```bash
cargo test -p usdcx-admin-notes 2>&1 | grep -E "^test result" 
cargo clippy -p usdcx-admin-notes --all-targets --features testing -- -D warnings 2>&1 | tail -2
cd bin/coordinator-frontend
npm run -s test:roundtrip 2>&1 | grep -E "Tests "
npm run -s test:admin 2>&1 | grep -E "Test Files|Tests "
npm run -s test:ledger 2>&1 | grep -E "Tests "
npm run -s typecheck && npx next lint --dir src --dir tests 2>&1 | grep -c "Error:"
npm run -s build 2>&1 | grep -iE "error|Compiled"
NEXT_PUBLIC_APP_MODE=admin NEXT_PUBLIC_AGGLAYER_BRIDGE_ID=0xcccccccccccccccccccccccccccccccc npm run -s build 2>&1 | grep -iE "error|Compiled|/dashboard/admin"
git checkout -- next-env.d.ts
```

Expected: every Rust test file `ok`; clippy clean; roundtrip and admin suites pass (admin count = 132 + the new tests); ledger 157; typecheck clean; 0 lint errors; both builds "Compiled successfully" with no `error` lines.

- [ ] **Step 3: Record and commit**

Append to `tasks/todo.md` a "Round 4: AggLayer console" section listing Tasks 1-11 checked, and the open item: "set `NEXT_PUBLIC_AGGLAYER_BRIDGE_ID` on the Vercel project once the testnet bridge is deployed; then live check: connect the BRIDGE_ADMIN multisig, grant PAUSER to a Bread account, pause via Bread, unpause via the multisig, read the History page."

```bash
git add bin/coordinator-frontend/.env.example docs/DEPLOY_VERCEL.md .github/workflows/test.yml tasks/todo.md
git commit -m "docs(admin): AggLayer bridge id variable, CI admin build covers the bridge paths"
```

- [ ] **Step 4: Deploy (with the user's go-ahead) and verify no regression**

The user runs or authorises: `vercel --prod --yes --scope dominik1999s-projects` from `bin/coordinator-frontend` (the bridge id is NOT set on the project yet). Then open https://usdcx-admin-testnet.vercel.app/dashboard/admin in Chrome and confirm: banner says "USDCx Admin Console", no switcher, the actions and Roles page unchanged, the Transactions and History pages still list the account's transactions.

---

## Self-review notes

- Spec coverage: §4 crate -> Tasks 1-3; §5 abstraction -> Tasks 4-7; §6 detection -> Task 8; §7 screens -> Tasks 9a/9b; §8 errors -> Task 8 (`error` evaluations) and 9b (per-target alerts); §9 tests -> every task; §10 rollout -> Task 11. Spec §5's `contractId` rename is replaced by the documented deviation (keep `faucetId`); spec §5's "`assertAdminConfig` removed or wired" -> removed in Task 4, doc fixed in Task 11.
- Review Focus 1 -> Task 7 test "blocks renouncing the last BRIDGE_ADMIN"; 2 -> Task 5 (`agg_v1_` decode) and Task 8 (selection); 3 -> Task 6 (`isRoleSymbol`; the forms use a select so free text never reaches the builder); 4 -> Task 8 ("skips a target the node could not serve"); 5 -> Task 2 (`is_paused` after pause) and Task 9b (status cell).
- Type consistency: `FaucetBytesState` moves to `@/hooks/useAdminTargets` (Task 8) and every form imports it from there; `resolveActionSender(action, target, roles, breadRoles)` (Task 6) is what `admin/page.tsx` calls (Task 9b); `runGuardrails(bytes, target, recipe, inflight)` (Task 7) is what `AdminActionCard` calls (Task 9a); `actionInfo`/`actionLabel`/`actionsOfRole` take the profile first everywhere.
