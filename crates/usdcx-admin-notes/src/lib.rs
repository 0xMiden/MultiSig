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

use miden_protocol::account::{Account, AccountId, RoleSymbol, StorageMapKey};
use miden_protocol::asset::{AssetAmount, FungibleAsset};
use miden_protocol::crypto::rand::RandomCoin;
use miden_protocol::errors::NoteError;
use miden_protocol::note::{Note, NoteScriptRoot};
use miden_protocol::{Felt, Word};
use miden_standards::account::access::RoleBasedAccessControl;
use miden_standards::note::config::{
    BlocklistConfig, BlocklistConfigNote, ConstantFeePolicyConfigNote, FaucetMetadataConfig,
    FaucetMetadataConfigNote, PauseConfig, PauseConfigNote, RbacConfig, RbacConfigNote,
};
use xusdc_encoding::note::xreserve_admin::{XReserveMinBurnAmountNote, XReserveSetAttesterNote};

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
// Faucet-owned admin notes (scripts live in xusdc-encoding)
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
