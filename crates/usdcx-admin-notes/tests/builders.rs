//! Root-parity, determinism, and structural tests for the admin-note builders.
//!
//! Root parity is the load-bearing guarantee: each built note's script MAST root
//! must equal the faucet's frozen allowlist root (`<Note>::script_root()`), or the
//! keyless faucet will reject it. Determinism guarantees a proposal can be
//! reproduced byte-for-byte at execution time from `(params, serial)`.

use miden_protocol::account::{AccountId, AccountIdVersion, AccountType, AssetCallbackFlag};
use miden_protocol::asset::{Asset, FungibleAsset};
use miden_protocol::note::{Note, NoteScriptRoot};
use miden_protocol::{Felt, Word};
use miden_standards::note::{
    BlocklistConfigNote, ConstantFeePolicyConfigNote, FaucetMetadataConfigNote, FeeSponsorshipNote,
    MinBurnAmountConfigNote, PauseConfigNote, RbacConfig, RbacConfigNote,
};
use xusdc_encoding::note::xreserve_admin::{XReserveMinBurnAmountNote, XReserveSetAttesterNote};

use usdcx_admin_notes as admin;

fn faucet() -> AccountId {
    // Public + callbacks-enabled: valid as both a network-account note target and
    // a fungible-asset issuer (mirrors usdcx's `test_faucet_id`).
    AccountId::dummy(
        [9u8; 15],
        AccountIdVersion::Version1,
        AccountType::Public,
        AssetCallbackFlag::Enabled,
    )
}

fn sender() -> AccountId {
    AccountId::dummy(
        [1u8; 15],
        AccountIdVersion::Version1,
        AccountType::Public,
        AssetCallbackFlag::Disabled,
    )
}

fn other() -> AccountId {
    AccountId::dummy(
        [2u8; 15],
        AccountIdVersion::Version1,
        AccountType::Public,
        AssetCallbackFlag::Disabled,
    )
}

fn serial(n: u64) -> Word {
    Word::from([
        Felt::new(n).unwrap(),
        Felt::new(n + 1).unwrap(),
        Felt::new(n + 2).unwrap(),
        Felt::new(n + 3).unwrap(),
    ])
}

fn root_of(note: &Note) -> NoteScriptRoot {
    note.script().root()
}

/// Build one of each note (with the shared serial) for reuse across tests.
fn fee_asset() -> FungibleAsset {
    FungibleAsset::new(faucet(), 100).unwrap()
}

// --------------------------------------------------------------------------
// Root parity: each built note's script root == the allowlisted root.
// --------------------------------------------------------------------------

#[test]
fn root_parity_all_notes() {
    let s = serial(10);

    let max_supply = admin::set_max_supply(faucet(), sender(), 1_000_000, s).unwrap();
    assert_eq!(root_of(&max_supply), FaucetMetadataConfigNote::script_root(), "set_max_supply");

    let note_fee = admin::set_note_fee(
        faucet(),
        sender(),
        PauseConfigNote::script_root(),
        fee_asset(),
        s,
    )
    .unwrap();
    assert_eq!(root_of(&note_fee), ConstantFeePolicyConfigNote::script_root(), "set_note_fee");

    let feature = admin::pause(faucet(), sender(), false, s).unwrap();
    let sponsorship = admin::fee_sponsorship(
        sender(),
        other(),
        feature.id(),
        Asset::from(fee_asset()),
        s,
    )
    .unwrap();
    assert_eq!(root_of(&sponsorship), FeeSponsorshipNote::script_root(), "fee_sponsorship");

    let grant = admin::rbac(
        faucet(),
        sender(),
        RbacConfig::GrantRole {
            role: admin::role_symbol(admin::DOM_UNPAUSER_ROLE).unwrap(),
            account: other(),
        },
        s,
    )
    .unwrap();
    assert_eq!(root_of(&grant), RbacConfigNote::script_root(), "rbac");

    let pause = admin::pause(faucet(), sender(), false, s).unwrap();
    assert_eq!(root_of(&pause), PauseConfigNote::script_root(), "pause");
    let unpause = admin::pause(faucet(), sender(), true, s).unwrap();
    assert_eq!(root_of(&unpause), PauseConfigNote::script_root(), "unpause");

    let block = admin::blocklist(faucet(), sender(), other(), false, s).unwrap();
    assert_eq!(root_of(&block), BlocklistConfigNote::script_root(), "block");
    let unblock = admin::blocklist(faucet(), sender(), other(), true, s).unwrap();
    assert_eq!(root_of(&unblock), BlocklistConfigNote::script_root(), "unblock");

    let min_burn = admin::set_min_burn(faucet(), sender(), 5, s).unwrap();
    // The faucet-owned min-burn note ships the stock script; both roots must agree.
    assert_eq!(root_of(&min_burn), XReserveMinBurnAmountNote::script_root(), "set_min_burn (xreserve root)");
    assert_eq!(root_of(&min_burn), MinBurnAmountConfigNote::script_root(), "set_min_burn (stock root)");

    let attester = admin::set_attester(faucet(), sender(), serial(99), true, s).unwrap();
    assert_eq!(root_of(&attester), XReserveSetAttesterNote::script_root(), "set_attester");
}

// --------------------------------------------------------------------------
// Determinism: same (params, serial) => identical note; different serial => not.
// --------------------------------------------------------------------------

#[test]
fn determinism_same_serial_same_note() {
    let s = serial(42);
    let a = admin::pause(faucet(), sender(), true, s).unwrap();
    let b = admin::pause(faucet(), sender(), true, s).unwrap();
    assert_eq!(a.id(), b.id(), "same serial must reproduce the note byte-for-byte");

    let c = admin::pause(faucet(), sender(), true, serial(43)).unwrap();
    assert_ne!(a.id(), c.id(), "different serial must produce a different note");
}

#[test]
fn determinism_faucet_owned_notes() {
    // The faucet-owned notes draw their serial from a seeded RNG; the seed must
    // reproduce the note.
    let s = serial(7);
    let a = admin::set_attester(faucet(), sender(), serial(1), true, s).unwrap();
    let b = admin::set_attester(faucet(), sender(), serial(1), true, s).unwrap();
    assert_eq!(a.id(), b.id(), "seeded set_attester must be reproducible");

    let a2 = admin::set_min_burn(faucet(), sender(), 3, s).unwrap();
    let b2 = admin::set_min_burn(faucet(), sender(), 3, s).unwrap();
    assert_eq!(a2.id(), b2.id(), "seeded set_min_burn must be reproducible");
}

// --------------------------------------------------------------------------
// Guards.
// --------------------------------------------------------------------------

#[test]
fn min_burn_floor_rejected() {
    // Floor is 1; zero must be refused.
    let err = admin::set_min_burn(faucet(), sender(), 0, serial(5));
    assert!(err.is_err(), "min-burn below the floor must be rejected");
}

#[test]
fn invalid_role_symbol_rejected() {
    assert!(admin::role_symbol("not a role!").is_err());
    assert!(admin::role_symbol(admin::DOM_UNPAUSER_ROLE).is_ok());
}
