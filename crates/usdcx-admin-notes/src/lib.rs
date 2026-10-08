//! Builders for the admin notes a multisig account (holding a usdcx faucet's
//! ADMIN / sub-role) can create.
//!
//! usdcx authorizes admin actions by RBAC on the note *sender*'s account id, so
//! the multisig simply produces (is the sender of) these notes; its own
//! `AuthGuardedMultisig` auth gates the transaction that creates them. Each
//! builder here returns a [`Note`] whose `sender` is the multisig account and
//! whose `target` is the faucet; the caller assembles the transaction (setting
//! `fee_conversion_salt`) and drives the multisig propose/sign/execute flow.
//!
//! Determinism: every builder takes an explicit `serial` [`Word`] so a proposal
//! can be reproduced byte-for-byte at execution time. Stock notes use it as the
//! note serial number directly; the two faucet-owned notes draw their serial from
//! an RNG, so we seed a deterministic [`RpoRandomCoin`] from `serial`.
//!
//! See `docs/usdcx-admin-notes-spec.md`.

use miden_protocol::account::{
    Account, AccountId, RoleSymbol, StorageMapKey, StorageSlotContent, StorageSlotName,
};
use miden_protocol::asset::{AssetAmount, FungibleAsset};
use miden_protocol::crypto::rand::RandomCoin;
use miden_protocol::errors::NoteError;
use miden_protocol::note::{Note, NoteScriptRoot};
use miden_protocol::{Felt, Word};
use miden_standards::account::access::RoleBasedAccessControl;
use miden_standards::account::policies::MinBurnAmount;
use miden_standards::note::config::{
    BlocklistConfig, BlocklistConfigNote, ConstantFeePolicyConfigNote, FaucetMetadataConfig,
    FaucetMetadataConfigNote, PauseConfig, PauseConfigNote, RbacConfig, RbacConfigNote,
};
use miden_usdcx::account::XReserveFaucetExtension;
use miden_usdcx::note::xreserve_admin::{XReserveMinBurnAmountNote, XReserveSetAttesterNote};

#[cfg(feature = "wasm")]
pub mod wasm;

#[cfg(feature = "testing")]
pub mod testing;

/// Errors from building a usdcx admin note.
#[derive(Debug, thiserror::Error)]
pub enum AdminNoteError {
    /// A standards / protocol note builder failed.
    #[error("note build failed: {0}")]
    Note(#[from] NoteError),
    /// The min-burn amount was below the faucet's floor.
    #[error("min-burn amount below floor: {0}")]
    MinBurnBelowFloor(String),
    /// An amount could not be represented as an `AssetAmount`.
    #[error("invalid asset amount: {0}")]
    Amount(String),
    /// A role symbol string was not a valid `RoleSymbol` (<=12 chars, A-Z and _).
    #[error("invalid role symbol: {0}")]
    Role(String),
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

/// The built-in `ADMIN` role symbol (from miden-standards RBAC).
pub fn admin_role() -> RoleSymbol {
    RoleBasedAccessControl::admin_role()
}

/// usdcx sub-role strings (RBAC keys on the note sender).
pub const ATTEST_ADMIN_ROLE: &str = "ATTEST_ADMIN";
/// See [`ATTEST_ADMIN_ROLE`].
pub const DOM_PAUSER_ROLE: &str = "DOM_PAUSER";
/// See [`ATTEST_ADMIN_ROLE`].
pub const DOM_UNPAUSER_ROLE: &str = "DOM_UNPAUSER";
/// See [`ATTEST_ADMIN_ROLE`].
pub const BLK_MANAGER_ROLE: &str = "BLK_MANAGER";

/// Parse a role symbol string (`"ADMIN"`, `"DOM_UNPAUSER"`, …) into a [`RoleSymbol`].
pub fn role_symbol(symbol: &str) -> Result<RoleSymbol, AdminNoteError> {
    RoleSymbol::new(symbol).map_err(|e| AdminNoteError::Role(format!("{symbol:?}: {e}")))
}

/// Returns `true` if `account` is a member of `role` in the RBAC role-membership
/// map of the given faucet `account` (the standards RBAC layout: membership key
/// `[0, role_symbol, acct_suffix, acct_prefix] -> [1, 0, 0, 0]`). Reads the faucet
/// account's on-chain storage; used to gate the frontend admin dropdown. Returns
/// `false` if the slot is absent or the entry is empty.
pub fn account_has_role(faucet: &Account, account: AccountId, role: &RoleSymbol) -> bool {
    let key = StorageMapKey::new(Word::from([
        Felt::ZERO,
        role.as_element(),
        account.suffix(),
        account.prefix().as_felt(),
    ]));
    match faucet
        .storage()
        .get_map_item(RoleBasedAccessControl::role_membership_slot(), key)
    {
        Ok(value) => value[0] == Felt::ONE,
        Err(_) => false,
    }
}

/// Returns every account id currently holding `role` in the RBAC role-membership map of the given
/// faucet `account` (the standards RBAC layout: membership key `[0, role_symbol, acct_suffix,
/// acct_prefix] -> [1, 0, 0, 0]` — see [`account_has_role`]). Scans the map's entries directly
/// (rather than probing membership one account at a time), which is what counting current `ADMIN`
/// holders for the "last admin" guardrail requires.
///
/// Returns an empty `Vec` if the role-membership slot is absent, or is not a storage map (both
/// should be impossible for a production faucet account, but this mirrors [`account_has_role`]'s
/// fail-safe-false behavior rather than panicking on a malformed account).
pub fn rbac_role_members(account: &Account, role: &RoleSymbol) -> Vec<AccountId> {
    let Some(slot) = account.storage().get(RoleBasedAccessControl::role_membership_slot()) else {
        return Vec::new();
    };
    let StorageSlotContent::Map(map) = slot.content() else {
        return Vec::new();
    };

    map.entries()
        .filter_map(|(key, value)| {
            let elements = key.as_elements();
            if elements[1] != role.as_element() || value[0] != Felt::ONE {
                return None;
            }
            AccountId::try_from_elements(elements[2], elements[3]).ok()
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Current on-chain config readers (for displaying current values in the UI)
// ---------------------------------------------------------------------------

/// The canonical integer value of a field element. A `Felt` serializes as its 8-byte canonical
/// little-endian integer, so this reads it back without depending on a `Felt`→`u64` accessor whose
/// name/trait varies across the miden-core/winter versions in the dependency graph.
fn felt_to_u64(f: Felt) -> u64 {
    use miden_protocol::utils::serde::Serializable;
    let bytes = f.to_bytes();
    let mut buf = [0u8; 8];
    let n = core::cmp::min(8, bytes.len());
    buf[..n].copy_from_slice(&bytes[..n]);
    u64::from_le_bytes(buf)
}

/// The faucet's current minimum burn amount (base units), read from the `MinBurnAmount` component's
/// value slot. Returns 0 if the slot is absent (not a valid faucet).
pub fn current_min_burn(faucet: &Account) -> u64 {
    faucet
        .storage()
        .get_item(MinBurnAmount::slot_name())
        .map(|w| felt_to_u64(w[0]))
        .unwrap_or(0)
}

/// The faucet's current maximum issuable supply (base units), read from the fungible faucet's
/// token-config slot (`[token_supply, max_supply, decimals, token_symbol]`). Returns 0 if absent.
pub fn current_max_supply(faucet: &Account) -> u64 {
    let slot = StorageSlotName::new("miden::standards::faucets::fungible::token_config")
        .expect("token config slot name is valid");
    faucet.storage().get_item(&slot).map(|w| felt_to_u64(w[1])).unwrap_or(0)
}

/// The faucet's current token supply (base units already issued), read from the fungible faucet's
/// token-config slot (`[token_supply, max_supply, decimals, token_symbol]`). Returns 0 if absent.
///
/// This is the floor for `set_max_supply`: the faucet rejects a new max supply below it
/// (`ERR_NEW_MAX_SUPPLY_BELOW_TOKEN_SUPPLY`), so the frontend reads it to validate the input before
/// a proposal is ever created.
pub fn current_token_supply(faucet: &Account) -> u64 {
    let slot = StorageSlotName::new("miden::standards::faucets::fungible::token_config")
        .expect("token config slot name is valid");
    faucet.storage().get_item(&slot).map(|w| felt_to_u64(w[0])).unwrap_or(0)
}

/// The current fee (base units) scheduled for `note_script_root` in the faucet's constant fee
/// policy, or `None` when no explicit fee is scheduled for that script (the fee schedule stores
/// `root -> [fee, 0, 0, 1]`, where the last element marks a set entry; unset keys read as zero).
pub fn note_fee(faucet: &Account, note_script_root: &NoteScriptRoot) -> Option<u64> {
    let slot = StorageSlotName::new("miden::standards::fees::policies::basic_constant_fee::fee_schedule")
        .expect("fee schedule slot name is valid");
    let key = StorageMapKey::new(Word::from(*note_script_root));
    match faucet.storage().get_map_item(&slot, key) {
        Ok(value) if value[3] == Felt::ONE => Some(felt_to_u64(value[0])),
        _ => None,
    }
}

/// The attester commitments currently enabled on the faucet, read from the xreserve attester
/// allowlist map (`commitment -> [1, 0, 0, 0]` for an enabled attester; `set_attester` with
/// `enabled = false` leaves the key with a zero marker, which the attestation check and this reader
/// both treat as disabled). Scans the map's entries, like [`rbac_role_members`].
///
/// Returns an empty `Vec` if the allowlist slot is absent or is not a storage map (fail-safe, as
/// [`rbac_role_members`] does), so a malformed account reads as "no attesters" rather than panicking.
pub fn enabled_attesters(faucet: &Account) -> Vec<Word> {
    let Some(slot) = faucet.storage().get(XReserveFaucetExtension::xreserve_attesters_slot()) else {
        return Vec::new();
    };
    let StorageSlotContent::Map(map) = slot.content() else {
        return Vec::new();
    };

    map.entries()
        .filter(|(_, value)| value[0] == Felt::ONE)
        .map(|(key, _)| Word::from(*key))
        .collect()
}

fn amount(value: u64) -> Result<AssetAmount, AdminNoteError> {
    AssetAmount::try_from(value).map_err(|e| AdminNoteError::Amount(e.to_string()))
}

/// A deterministic FeltRng seeded from the caller-supplied serial, for the two
/// faucet-owned notes whose builders draw their serial number from an RNG.
fn seeded_rng(serial: Word) -> RandomCoin {
    RandomCoin::new(serial)
}

// ---------------------------------------------------------------------------
// Stock miden-standards admin notes (roots baked in standards; SDK-compatible)
// ---------------------------------------------------------------------------

/// `set_max_supply` (role: ADMIN). The faucet must be **not paused**.
pub fn set_max_supply(
    faucet: AccountId,
    sender: AccountId,
    max_supply: u64,
    serial: Word,
) -> Result<Note, AdminNoteError> {
    let note = FaucetMetadataConfigNote::builder()
        .sender(sender)
        .target(faucet)
        .config(FaucetMetadataConfig::SetMaxSupply { max_supply: amount(max_supply)? })
        .serial_number(serial)
        .build()?;
    Ok(Note::from(note))
}

/// `set_note_fee` (role: ADMIN): reprice the constant fee for `note_script_root`.
pub fn set_note_fee(
    faucet: AccountId,
    sender: AccountId,
    note_script_root: NoteScriptRoot,
    fee_asset: FungibleAsset,
    serial: Word,
) -> Result<Note, AdminNoteError> {
    let note = ConstantFeePolicyConfigNote::builder()
        .sender(sender)
        .target(faucet)
        .note_script_root(note_script_root)
        .fee_asset(fee_asset)
        .serial_number(serial)
        .build()?;
    Ok(Note::from(note))
}

/// RBAC role management (role: ADMIN / the target role's effective admin):
/// grant / revoke / set-role-admin / renounce, via a caller-built [`RbacConfig`].
pub fn rbac(
    faucet: AccountId,
    sender: AccountId,
    config: RbacConfig,
    serial: Word,
) -> Result<Note, AdminNoteError> {
    let note = RbacConfigNote::builder()
        .sender(sender)
        .target(faucet)
        .config(config)
        .serial_number(serial)
        .build()?;
    Ok(Note::from(note))
}

/// `pause` / `unpause` (roles: DOM_PAUSER / DOM_UNPAUSER).
pub fn pause(
    faucet: AccountId,
    sender: AccountId,
    unpause: bool,
    serial: Word,
) -> Result<Note, AdminNoteError> {
    let config = if unpause {
        PauseConfig::Unpause
    } else {
        PauseConfig::Pause
    };
    let note = PauseConfigNote::builder()
        .sender(sender)
        .target(faucet)
        .config(config)
        .serial_number(serial)
        .build()?;
    Ok(Note::from(note))
}

/// `block` / `unblock` an account (role: BLK_MANAGER).
pub fn blocklist(
    faucet: AccountId,
    sender: AccountId,
    account: AccountId,
    unblock: bool,
    serial: Word,
) -> Result<Note, AdminNoteError> {
    let config = if unblock {
        BlocklistConfig::UnblockAccount { account }
    } else {
        BlocklistConfig::BlockAccount { account }
    };
    let note = BlocklistConfigNote::builder()
        .sender(sender)
        .target(faucet)
        .config(config)
        .serial_number(serial)
        .build()?;
    Ok(Note::from(note))
}

// ---------------------------------------------------------------------------
// Faucet-owned admin notes (scripts live in miden-usdcx)
// ---------------------------------------------------------------------------

/// `set_min_burn_amount` (role: ADMIN). Faucet-owned builder; enforces the floor
/// (`>= 1`). On-chain the script is the stock `MinBurnAmountConfigNote`.
pub fn set_min_burn(
    faucet: AccountId,
    sender: AccountId,
    min_burn: u64,
    serial: Word,
) -> Result<Note, AdminNoteError> {
    let mut rng = seeded_rng(serial);
    XReserveMinBurnAmountNote::builder()
        .sender(sender)
        .target(faucet)
        .min_burn_amount(amount(min_burn)?)
        .generate_serial_number(&mut rng)
        .build()
        .map_err(|e| AdminNoteError::MinBurnBelowFloor(e.to_string()))
}

/// `set_attester` (role: ATTEST_ADMIN): enable/disable an attester pubkey
/// commitment in the faucet's allowlist. Faucet-owned note script.
pub fn set_attester(
    faucet: AccountId,
    sender: AccountId,
    commitment: Word,
    enabled: bool,
    serial: Word,
) -> Result<Note, AdminNoteError> {
    let mut rng = seeded_rng(serial);
    XReserveSetAttesterNote::create(sender, faucet, commitment, u8::from(enabled), &mut rng)
        .map_err(AdminNoteError::from)
}
