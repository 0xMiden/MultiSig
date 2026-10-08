//! Test-only fixtures for exercising [`crate::account_has_role`] against a real 0.17
//! RBAC-seeded USDCx faucet account.
//!
//! Gated behind the `testing` feature (see the crate's `Cargo.toml`) rather than `#[cfg(test)]`,
//! because this crate's own integration tests (`tests/*.rs`) link the library as an ordinary
//! dependency rather than compiling it with `cfg(test)` set; the feature is what makes this
//! module visible to them (enabled via the self-referential `[dev-dependencies]` entry).

use miden_protocol::account::{
    Account, AccountId, AccountIdVersion, AccountType, AssetCallbackFlag, StorageMapKey,
};
use miden_protocol::asset::{AssetAmount, AssetId};
use miden_protocol::block::FeeParameters;
use miden_protocol::{Felt, Word};
use miden_standards::account::access::RoleBasedAccessControl;
use miden_testing::MockChain;
use miden_usdcx::account::XReserveFaucetExtension;
use miden_usdcx::account::xreserve::XReserveStablecoinBuilder;
use miden_usdcx::build_faucet_account;
use miden_usdcx::xreserve::encoding::CircleDomain;

/// A deterministic dummy `AccountId`, distinguished only by `seed`. Mirrors the
/// `miden-usdcx` test-support convention (`tests/support/mod.rs::test_account_id`).
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

/// Builds a USDCx faucet `Account` (via upstream `miden-usdcx`'s production
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

/// Builds a USDCx faucet `Account` (same production builder as [`faucet_with_admin`]) with the
/// built-in `ADMIN` role granted to TWO accounts: `admin_a` is seeded as the faucet's sole `owner`
/// at construction time (the production [`XReserveStablecoinBuilder`] only accepts a single
/// `ADMIN` holder at genesis — see its `owner` field), and `admin_b` is granted `ADMIN` afterward
/// by writing directly into the RBAC role-membership map via [`miden_protocol::account::AccountStorage::set_map_item`]
/// (mirroring the exact key layout [`crate::account_has_role`] reads: `[0, role_symbol,
/// acct_suffix, acct_prefix] -> [1, 0, 0, 0]`).
///
/// Exercises [`crate::rbac_role_members`], which must enumerate every current `ADMIN` holder, not
/// just the genesis owner.
///
/// Returns `(faucet, admin_a, admin_b)`.
pub fn faucet_with_two_admins() -> (Account, AccountId, AccountId) {
    let admin_a = dummy_account_id(1);
    let admin_b = dummy_account_id(2);

    let mut faucet = build_faucet_account(
        [0u8; 32],
        AssetAmount::new(1_000_000).expect("1_000_000 is a valid token supply"),
        admin_a,
        Vec::new(), // attest_admin_holders
        Vec::new(), // pauser_holders
        Vec::new(), // unpauser_holders
        Vec::new(), // blocklist_manager_holders
        FeeParameters::new(0),
        AssetId::new_fungible(dummy_fee_faucet_id()),
        CircleDomain::MIDEN,
    )
    .expect("the production faucet builder should succeed for a minimal RBAC seed");

    let admin_role = RoleBasedAccessControl::admin_role();
    let key = StorageMapKey::new(Word::from([
        Felt::ZERO,
        admin_role.as_element(),
        admin_b.suffix(),
        admin_b.prefix().as_felt(),
    ]));
    faucet
        .storage_mut()
        .set_map_item(
            RoleBasedAccessControl::role_membership_slot(),
            key,
            Word::from([Felt::ONE, Felt::ZERO, Felt::ZERO, Felt::ZERO]),
        )
        .expect("granting ADMIN to a second holder directly in the RBAC role-membership map");

    (faucet, admin_a, admin_b)
}

/// Builds a USDCx faucet `Account` (same production builder as [`faucet_with_admin`]) with two
/// entries written directly into the xreserve attester allowlist map, the way the faucet's own
/// `set_attester` path leaves them: `enabled` under the enabled marker `[1, 0, 0, 0]`, and
/// `disabled` under a zero marker (an attester that was enabled, then disabled).
///
/// Exercises [`crate::enabled_attesters`], which must list the first and skip the second.
///
/// Returns `(faucet, enabled, disabled)`.
pub fn faucet_with_attesters() -> (Account, Word, Word) {
    let (mut faucet, _holder, _other) = faucet_with_admin();

    let enabled = Word::from([11u32, 12, 13, 14]);
    let disabled = Word::from([21u32, 22, 23, 24]);
    let slot = XReserveFaucetExtension::xreserve_attesters_slot();

    faucet
        .storage_mut()
        .set_map_item(
            slot,
            StorageMapKey::new(enabled),
            Word::from([Felt::ONE, Felt::ZERO, Felt::ZERO, Felt::ZERO]),
        )
        .expect("enabling an attester directly in the allowlist map");
    faucet
        .storage_mut()
        .set_map_item(slot, StorageMapKey::new(disabled), Word::default())
        .expect("disabling an attester directly in the allowlist map");

    (faucet, enabled, disabled)
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

/// A `miden_testing::MockChain` seeded with a real 0.17 USDCx faucet — the production
/// `XReserveStablecoinBuilder` composition plus the production keyless `AuthNetworkAccount`
/// (exactly the shape [`miden_usdcx::build_faucet_account`] assembles; this fixture composes it
/// manually only to reach `Account::builder(..).build_existing()`, an "already deployed" account
/// with no seed and nonce one, which is what a `MockChain` genesis account requires; the plain
/// `build_faucet_account` shape carries a seed and nonce zero — an undeployed account — and
/// `MockChainBuilder::add_account` rejects that).
///
/// `admin` holds the built-in `ADMIN` role; `pauser` holds `DOM_PAUSER`; `attest_admin` holds
/// `ATTEST_ADMIN`; `other` holds neither.
/// Returns `(chain, faucet_id, admin, pauser, attest_admin, other)`.
///
/// This is the Round-trip guard fixture (Task 7 of the 0.17 port): proving a note this crate
/// BUILDS is actually CONSUMABLE by a deployed-equivalent faucet, and that its RBAC role gate is
/// enforced on-chain — not merely mirrored by this crate's own [`crate::account_has_role`]
/// read-back.
pub fn mock_chain_with_faucet_roles()
-> (MockChain, AccountId, AccountId, AccountId, AccountId, AccountId) {
    let admin = dummy_account_id(1);
    let pauser = dummy_account_id(2);
    let attest_admin = dummy_account_id(4);
    let other = dummy_account_id(3);

    let fee_parameters = FeeParameters::new(0);
    let fee_asset_id = AssetId::new_fungible(dummy_fee_faucet_id());

    let builder = XReserveStablecoinBuilder::builder()
        .token_supply(AssetAmount::new(1_000_000).expect("1_000_000 is a valid token supply"))
        .owner(admin)
        .attest_admin_holders(vec![attest_admin])
        .pauser_holders(vec![pauser])
        .unpauser_holders(Vec::new())
        .blocklist_manager_holders(Vec::new())
        .fee_parameters(fee_parameters.clone())
        .fee_asset_id(fee_asset_id)
        .domain(CircleDomain::MIDEN)
        .build()
        .expect("the production faucet builder should succeed for a minimal RBAC seed");
    let components = builder
        .build_components()
        .expect("composing the production faucet components should succeed");
    let auth = XReserveStablecoinBuilder::auth_component(fee_parameters, fee_asset_id)
        .expect("the production auth component should build");

    let mut account_builder = Account::builder([7u8; 32]).account_type(AccountType::Public);
    for component in components {
        account_builder = account_builder.with_component(component);
    }
    account_builder = account_builder.with_components(auth);
    let faucet = account_builder
        .build_existing()
        .expect("building the faucet as an already-deployed (genesis-ready) account");

    let faucet_id = faucet.id();
    let mut chain_builder = MockChain::builder();
    chain_builder
        .add_account(faucet)
        .expect("registering the faucet account in the MockChain");
    let chain = chain_builder.build().expect("building the MockChain");

    (chain, faucet_id, admin, pauser, attest_admin, other)
}
