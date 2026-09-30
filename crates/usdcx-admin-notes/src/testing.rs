//! Test-only fixtures for exercising [`crate::account_has_role`] against a real 0.17
//! RBAC-seeded USDCx faucet account.
//!
//! Gated behind the `testing` feature (see the crate's `Cargo.toml`) rather than `#[cfg(test)]`,
//! because this crate's own integration tests (`tests/*.rs`) link the library as an ordinary
//! dependency rather than compiling it with `cfg(test)` set; the feature is what makes this
//! module visible to them (enabled via the self-referential `[dev-dependencies]` entry).

use miden_protocol::account::{Account, AccountId, AccountIdVersion, AccountType, AssetCallbackFlag};
use miden_protocol::asset::{AssetAmount, AssetId};
use miden_protocol::block::FeeParameters;
use xusdc_encoding::build_faucet_account;
use xusdc_encoding::xreserve::encoding::CircleDomain;

/// A deterministic dummy `AccountId`, distinguished only by `seed`. Mirrors the
/// `xusdc-encoding` test-support convention (`tests/support/mod.rs::test_account_id`).
fn dummy_account_id(seed: u8) -> AccountId {
    AccountId::dummy(
        [seed; 15],
        AccountIdVersion::Version1,
        AccountType::Private,
        AssetCallbackFlag::Disabled,
    )
}

/// A deterministic PUBLIC dummy account id, suitable as the issuer of the network fee asset.
fn dummy_fee_faucet_id() -> AccountId {
    AccountId::dummy(
        [250; 15],
        AccountIdVersion::Version1,
        AccountType::Public,
        AssetCallbackFlag::Enabled,
    )
}

/// Builds a USDCx faucet `Account` (via upstream `xusdc-encoding`'s production
/// `XReserveStablecoinBuilder`, through its `build_faucet_account` entry point) with the built-in
/// `ADMIN` role granted to `holder` alone. The four operational sub-roles (`ATTEST_ADMIN`,
/// `DOM_PAUSER`, `DOM_UNPAUSER`, `BLK_MANAGER`) are seeded empty — irrelevant to this fixture.
///
/// Returns `(faucet, holder, other)`, where `other` is a distinct account id holding no role, for
/// asserting the negative case of [`crate::account_has_role`].
pub fn faucet_with_admin() -> (Account, AccountId, AccountId) {
    let holder = dummy_account_id(1);
    let other = dummy_account_id(2);

    let faucet = build_faucet_account(
        [0u8; 32],
        AssetAmount::new(1_000_000).expect("1_000_000 is a valid token supply"),
        holder,
        Vec::new(), // attest_admin_holders
        Vec::new(), // pauser_holders
        Vec::new(), // unpauser_holders
        Vec::new(), // blocklist_manager_holders
        FeeParameters::new(0),
        AssetId::new_fungible(dummy_fee_faucet_id()),
        CircleDomain::MIDEN,
    )
    .expect("the production faucet builder should succeed for a minimal RBAC seed");

    (faucet, holder, other)
}

/// A deterministic `(faucet, sender)` pair of `AccountId`s for exercising the stock
/// miden-standards config-note builders (`crate::{set_max_supply, set_note_fee, rbac, pause,
/// blocklist}`), which only need account IDs, not a fully built `Account`.
///
/// `faucet` is Public + asset-callbacks-enabled: valid both as the `NetworkAccountTarget` these
/// builders bind their note to (which requires a public target) and as the issuer of the fee
/// asset `set_note_fee` schedules. `sender` is a distinct Public account id, standing in for the
/// multisig account that would actually send these notes.
pub fn faucet_and_sender() -> (AccountId, AccountId) {
    let faucet = AccountId::dummy(
        [9u8; 15],
        AccountIdVersion::Version1,
        AccountType::Public,
        AssetCallbackFlag::Enabled,
    );
    let sender = AccountId::dummy(
        [1u8; 15],
        AccountIdVersion::Version1,
        AccountType::Public,
        AssetCallbackFlag::Disabled,
    );
    (faucet, sender)
}

/// A third, distinct public `AccountId` — neither `faucet` nor `sender` from
/// [`faucet_and_sender`] — for tests exercising a builder argument (e.g. an RBAC grantee or a
/// blocklist target) that must be visibly different from the note's own `sender`.
pub fn other_account() -> AccountId {
    AccountId::dummy(
        [7u8; 15],
        AccountIdVersion::Version1,
        AccountType::Public,
        AssetCallbackFlag::Disabled,
    )
}
