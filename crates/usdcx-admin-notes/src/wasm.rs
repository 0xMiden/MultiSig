//! wasm-bindgen JS bindings for the admin-note builders and the faucet-RBAC
//! role check. Built with `wasm-pack build --target web --features wasm`.
//!
//! Interop is bytes-only: `Word`/`NoteScriptRoot`/`Account` cross the
//! boundary as serialized bytes (round-tripped with the `@miden-sdk` types on the
//! JS side, which share the same 0.17 serialization); account ids cross as hex.
//! Each builder returns a serialized `Note` (`Uint8Array`); the frontend
//! deserializes it with `@miden-sdk`'s `Note.deserialize`.

use miden_protocol::account::{Account, AccountId};
use miden_protocol::asset::FungibleAsset;
use miden_protocol::note::NoteScriptRoot;
use miden_protocol::utils::serde::{Deserializable, Serializable};
use miden_protocol::Word;
use miden_standards::note::config::RbacConfig;
use wasm_bindgen::prelude::*;

use crate as builders;

fn js<E: core::fmt::Display>(e: E) -> JsError {
    JsError::new(&e.to_string())
}

fn acct(hex: &str) -> Result<AccountId, JsError> {
    AccountId::from_hex(hex).map_err(js)
}

fn word(bytes: &[u8]) -> Result<Word, JsError> {
    Word::read_from_bytes(bytes).map_err(js)
}

// --- role detection --------------------------------------------------------

/// Returns whether `account_hex` holds `role` on the faucet, given the faucet's
/// serialized `Account` bytes (fetch via `@miden-sdk` `client.getAccount(faucetId)`
/// then `.serialize()`). Used to gate the admin dropdown.
#[wasm_bindgen]
pub fn account_has_role(
    faucet_account: &[u8],
    account_hex: &str,
    role: &str,
) -> Result<bool, JsError> {
    let faucet = Account::read_from_bytes(faucet_account).map_err(js)?;
    let role = builders::role_symbol(role).map_err(js)?;
    Ok(builders::account_has_role(&faucet, acct(account_hex)?, &role))
}

/// Returns the hex account ids of every current holder of `role` on the faucet, given the
/// faucet's serialized `Account` bytes (same fetch path as [`account_has_role`]). Used to drive
/// the frontend's mandatory "last-ADMIN" guardrail, which `account_has_role`'s one-account-at-a-
/// time boolean cannot support.
#[wasm_bindgen]
pub fn rbac_role_members(faucet_account: &[u8], role: &str) -> Result<Vec<String>, JsError> {
    let faucet = Account::read_from_bytes(faucet_account).map_err(js)?;
    let role = builders::role_symbol(role).map_err(js)?;
    Ok(builders::rbac_role_members(&faucet, &role)
        .iter()
        .map(|id| id.to_hex())
        .collect())
}

// --- current on-chain config readers ---------------------------------------

/// The faucet's current minimum burn amount (base units), from its serialized `Account` bytes.
#[wasm_bindgen]
pub fn current_min_burn(faucet_account: &[u8]) -> Result<u64, JsError> {
    let faucet = Account::read_from_bytes(faucet_account).map_err(js)?;
    Ok(builders::current_min_burn(&faucet))
}

/// The faucet's current maximum issuable supply (base units), from its serialized `Account` bytes.
#[wasm_bindgen]
pub fn current_max_supply(faucet_account: &[u8]) -> Result<u64, JsError> {
    let faucet = Account::read_from_bytes(faucet_account).map_err(js)?;
    Ok(builders::current_max_supply(&faucet))
}

/// The faucet's current token supply (base units already issued), from its serialized `Account`
/// bytes. This is the floor a new max supply must not drop below.
#[wasm_bindgen]
pub fn current_token_supply(faucet_account: &[u8]) -> Result<u64, JsError> {
    let faucet = Account::read_from_bytes(faucet_account).map_err(js)?;
    Ok(builders::current_token_supply(&faucet))
}

/// The current fee (base units) scheduled for `note_script_root`, or `undefined` when no explicit
/// fee is set for that script. Script root crosses as serialized `NoteScriptRoot` bytes.
#[wasm_bindgen]
pub fn note_fee(faucet_account: &[u8], note_script_root: &[u8]) -> Result<Option<u64>, JsError> {
    let faucet = Account::read_from_bytes(faucet_account).map_err(js)?;
    let root = NoteScriptRoot::read_from_bytes(note_script_root).map_err(js)?;
    Ok(builders::note_fee(&faucet, &root))
}

// --- stock admin notes -----------------------------------------------------

/// Build a `set_max_supply` note. Returns serialized `Note` bytes.
#[wasm_bindgen]
pub fn build_set_max_supply(
    faucet_hex: &str,
    sender_hex: &str,
    max_supply: u64,
    serial: &[u8],
) -> Result<Vec<u8>, JsError> {
    let note =
        builders::set_max_supply(acct(faucet_hex)?, acct(sender_hex)?, max_supply, word(serial)?)
            .map_err(js)?;
    Ok(note.to_bytes())
}

/// Build a `set_note_fee` note repricing `note_script_root` to `fee_amount` of
/// the `fee_faucet` asset. `note_script_root` is serialized `NoteScriptRoot` bytes.
#[wasm_bindgen]
pub fn build_set_note_fee(
    faucet_hex: &str,
    sender_hex: &str,
    note_script_root: &[u8],
    fee_faucet_hex: &str,
    fee_amount: u64,
    serial: &[u8],
) -> Result<Vec<u8>, JsError> {
    let root = NoteScriptRoot::read_from_bytes(note_script_root).map_err(js)?;
    let fee_asset = FungibleAsset::new(acct(fee_faucet_hex)?, fee_amount).map_err(js)?;
    let note =
        builders::set_note_fee(acct(faucet_hex)?, acct(sender_hex)?, root, fee_asset, word(serial)?)
            .map_err(js)?;
    Ok(note.to_bytes())
}

/// Build an RBAC grant note.
#[wasm_bindgen]
pub fn build_rbac_grant(
    faucet_hex: &str,
    sender_hex: &str,
    role: &str,
    account_hex: &str,
    serial: &[u8],
) -> Result<Vec<u8>, JsError> {
    let config = RbacConfig::GrantRole {
        role: builders::role_symbol(role).map_err(js)?,
        account: acct(account_hex)?,
    };
    let note =
        builders::rbac(acct(faucet_hex)?, acct(sender_hex)?, config, word(serial)?).map_err(js)?;
    Ok(note.to_bytes())
}

/// Build an RBAC revoke note.
#[wasm_bindgen]
pub fn build_rbac_revoke(
    faucet_hex: &str,
    sender_hex: &str,
    role: &str,
    account_hex: &str,
    serial: &[u8],
) -> Result<Vec<u8>, JsError> {
    let config = RbacConfig::RevokeRole {
        role: builders::role_symbol(role).map_err(js)?,
        account: acct(account_hex)?,
    };
    let note =
        builders::rbac(acct(faucet_hex)?, acct(sender_hex)?, config, word(serial)?).map_err(js)?;
    Ok(note.to_bytes())
}

/// Build a `pause` (`unpause = false`) or `unpause` (`unpause = true`) note.
#[wasm_bindgen]
pub fn build_pause(
    faucet_hex: &str,
    sender_hex: &str,
    unpause: bool,
    serial: &[u8],
) -> Result<Vec<u8>, JsError> {
    let note =
        builders::pause(acct(faucet_hex)?, acct(sender_hex)?, unpause, word(serial)?).map_err(js)?;
    Ok(note.to_bytes())
}

/// Build a `block` (`unblock = false`) or `unblock` (`unblock = true`) note.
#[wasm_bindgen]
pub fn build_blocklist(
    faucet_hex: &str,
    sender_hex: &str,
    account_hex: &str,
    unblock: bool,
    serial: &[u8],
) -> Result<Vec<u8>, JsError> {
    let note = builders::blocklist(
        acct(faucet_hex)?,
        acct(sender_hex)?,
        acct(account_hex)?,
        unblock,
        word(serial)?,
    )
    .map_err(js)?;
    Ok(note.to_bytes())
}

// --- faucet-owned admin notes ---------------------------------------------

/// Build a `set_min_burn_amount` note (faucet-owned; floor >= 1).
#[wasm_bindgen]
pub fn build_set_min_burn(
    faucet_hex: &str,
    sender_hex: &str,
    min_burn: u64,
    serial: &[u8],
) -> Result<Vec<u8>, JsError> {
    let note = builders::set_min_burn(acct(faucet_hex)?, acct(sender_hex)?, min_burn, word(serial)?)
        .map_err(js)?;
    Ok(note.to_bytes())
}

/// Build a `set_attester` note (faucet-owned). `commitment` is serialized `Word` bytes.
#[wasm_bindgen]
pub fn build_set_attester(
    faucet_hex: &str,
    sender_hex: &str,
    commitment: &[u8],
    enabled: bool,
    serial: &[u8],
) -> Result<Vec<u8>, JsError> {
    let note = builders::set_attester(
        acct(faucet_hex)?,
        acct(sender_hex)?,
        word(commitment)?,
        enabled,
        word(serial)?,
    )
    .map_err(js)?;
    Ok(note.to_bytes())
}
