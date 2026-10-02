//! Round-trip guard (Task 7 of the 0.17 port): proves a note this crate BUILDS is actually
//! CONSUMABLE — executes and is accepted — by a real 0.17 USDCx faucet, and that its on-chain RBAC
//! gate is real, not merely mirrored by this crate's own `account_has_role` read-back.
//!
//! Builds a production-shaped faucet (`miden-usdcx`'s `XReserveStablecoinBuilder` composition,
//! the same one `build_faucet_account` assembles) inside a `miden-testing::MockChain`, with the
//! acting accounts granted `ADMIN` / `DOM_PAUSER`, and executes notes built by
//! `usdcx_admin_notes::{set_max_supply, pause}` against it — both the success path (role holder)
//! and the on-chain rejection (non-holder).
//!
//! See `.superpowers/sdd/2026-09-30-usdcx-admin-notes-0.17-port/task-7-brief.md`.

use miden_protocol::account::{StorageMapKey, StorageSlotName, StorageSlotPatch};
use miden_protocol::errors::MasmError;
use miden_protocol::transaction::ExecutedTransaction;
use miden_protocol::{Felt, Word};
use miden_standards::account::access::{PausableStorage, RoleBasedAccessControl};
use miden_standards::account::faucets::FungibleFaucet;
use miden_standards::account::policies::MinBurnAmount;
use miden_standards::note::config::RbacConfig;
use miden_testing::assert_transaction_executor_error;
use miden_usdcx::account::xreserve::XReserveFaucetExtension;

use usdcx_admin_notes::testing::mock_chain_with_faucet_roles;

fn serial(n: u64) -> Word {
    Word::from([
        Felt::new(n).unwrap(),
        Felt::new(n + 1).unwrap(),
        Felt::new(n + 2).unwrap(),
        Felt::new(n + 3).unwrap(),
    ])
}

/// The stock RBAC authority-gate trap (`rbac.masm` `ERR_SENDER_LACKS_ROLE`) — what a note sender
/// without the required role gets from every RBAC-gated faucet procedure. Under the faucet's
/// role-based authority this is the SAME error for every gate, whether the procedure has a
/// dedicated role (pause / blocklist) or falls back to `ADMIN` (`set_max_supply`, `set_note_fee`,
/// the policy setters).
fn err_sender_lacks_role() -> MasmError {
    MasmError::from_static_str("note sender does not hold the required role")
}

/// Reads a value-slot's post-tx word from the account delta (the slot's new value).
fn value_delta(tx: &ExecutedTransaction, name: &StorageSlotName) -> Word {
    match tx.account_patch().storage().get(name) {
        Some(StorageSlotPatch::Value(w)) => w.value().expect("value patch carries a value"),
        other => panic!("value slot {name} expected a value delta, got {other:?}"),
    }
}

/// A `set_max_supply` note sent by the `ADMIN` holder is CONSUMED by the faucet: the transaction
/// succeeds and the faucet's `token_config` slot's max-supply word (word[1]) is updated to the new
/// cap — proving this crate's builder output is not just well-formed, but actually accepted and
/// acted on by a deployed-equivalent 0.17 faucet.
#[tokio::test]
async fn set_max_supply_note_consumes_on_0_17_faucet() {
    let (chain, faucet_id, admin, _pauser, _attest_admin, _other) = mock_chain_with_faucet_roles();
    let note = usdcx_admin_notes::set_max_supply(faucet_id, admin, 5_000_000, serial(100))
        .expect("building the set_max_supply note");

    let tx = chain
        .build_transaction(faucet_id)
        .unauthenticated_input_note(note.clone())
        .build()
        .expect("building the set_max_supply transaction")
        .execute()
        .await
        .expect("the 0.17 faucet must consume an ADMIN-sent set_max_supply note");

    assert_eq!(
        value_delta(&tx, FungibleFaucet::token_config_slot())[1],
        Felt::try_from(5_000_000u64).expect("cap within the field"),
        "set_max_supply must write the new cap into token_config word[1]",
    );
}

/// The same builder, but the note's sender holds NEITHER `ADMIN` nor any other role: the faucet's
/// network auth admits the note (the script is allowlisted) but the procedure's own RBAC gate
/// traps it — `set_max_supply` cannot be reached by an unauthorized sender.
#[tokio::test]
async fn set_max_supply_note_from_non_admin_fails_on_0_17_faucet() {
    let (chain, faucet_id, _admin, _pauser, _attest_admin, other) = mock_chain_with_faucet_roles();
    let note = usdcx_admin_notes::set_max_supply(faucet_id, other, 5_000_000, serial(101))
        .expect("building the set_max_supply note");

    let result = chain
        .build_transaction(faucet_id)
        .unauthenticated_input_note(note.clone())
        .build()
        .expect("building the set_max_supply transaction")
        .execute()
        .await;

    assert_transaction_executor_error!(result, err_sender_lacks_role());
}

/// A `pause` note sent by a `DOM_PAUSER` holder is CONSUMED: the transaction succeeds and the
/// faucet's `is_paused` slot flips to 1.
#[tokio::test]
async fn pause_note_from_dom_pauser_consumes_on_0_17_faucet() {
    let (chain, faucet_id, _admin, pauser, _attest_admin, _other) = mock_chain_with_faucet_roles();
    let note = usdcx_admin_notes::pause(faucet_id, pauser, false, serial(102))
        .expect("building the pause note");

    let tx = chain
        .build_transaction(faucet_id)
        .unauthenticated_input_note(note.clone())
        .build()
        .expect("building the pause transaction")
        .execute()
        .await
        .expect("the 0.17 faucet must consume a DOM_PAUSER-sent pause note");

    assert_eq!(
        value_delta(&tx, PausableStorage::is_paused_slot()),
        Word::from([Felt::from(1u32), Felt::ZERO, Felt::ZERO, Felt::ZERO]),
        "pause must set is_paused = 1",
    );
}

/// The role gate is REAL, not just mirrored by this crate's own `account_has_role` read-back: the
/// SAME pause note, sent by an account holding NO role (not even `ADMIN` — the faucet's Circle
/// model gives the administrator no pause path), is rejected ON-CHAIN by the faucet's own RBAC
/// check. The note passes network auth (the script is allowlisted) but traps at the procedure's
/// role gate.
#[tokio::test]
async fn pause_note_from_non_pauser_fails_on_0_17_faucet() {
    let (chain, faucet_id, _admin, _pauser, _attest_admin, other) = mock_chain_with_faucet_roles();
    let note = usdcx_admin_notes::pause(faucet_id, other, false, serial(103))
        .expect("building the pause note");

    let result = chain
        .build_transaction(faucet_id)
        .unauthenticated_input_note(note.clone())
        .build()
        .expect("building the pause transaction")
        .execute()
        .await;

    assert_transaction_executor_error!(result, err_sender_lacks_role());
}

/// A `set_min_burn` note sent by the `ADMIN` holder is CONSUMED by the faucet: the transaction
/// succeeds and the stock `MinBurnAmount` floor slot is updated to the new floor — the same
/// faucet-owned coverage gap the whole-branch review flagged (Task 7 only covered
/// `set_max_supply`/`pause`; `set_min_burn`'s script also lives in `miden-usdcx`).
#[tokio::test]
async fn set_min_burn_note_consumes_on_0_17_faucet() {
    let (chain, faucet_id, admin, _pauser, _attest_admin, _other) =
        mock_chain_with_faucet_roles();
    let note = usdcx_admin_notes::set_min_burn(faucet_id, admin, 5_000, serial(104))
        .expect("building the set_min_burn note");

    let tx = chain
        .build_transaction(faucet_id)
        .unauthenticated_input_note(note.clone())
        .build()
        .expect("building the set_min_burn transaction")
        .execute()
        .await
        .expect("the 0.17 faucet must consume an ADMIN-sent set_min_burn note");

    assert_eq!(
        value_delta(&tx, MinBurnAmount::slot_name())[0],
        Felt::try_from(5_000u64).expect("floor within the field"),
        "set_min_burn must write the new floor into the stock MinBurnAmount slot",
    );
}

/// The same builder, sent by an account holding no role, PASSES network auth (the script is
/// allowlisted) but TRAPS at the procedure's own `ADMIN` gate.
#[tokio::test]
async fn set_min_burn_note_from_non_admin_fails_on_0_17_faucet() {
    let (chain, faucet_id, _admin, _pauser, _attest_admin, other) =
        mock_chain_with_faucet_roles();
    let note = usdcx_admin_notes::set_min_burn(faucet_id, other, 5_000, serial(105))
        .expect("building the set_min_burn note");

    let result = chain
        .build_transaction(faucet_id)
        .unauthenticated_input_note(note.clone())
        .build()
        .expect("building the set_min_burn transaction")
        .execute()
        .await;

    assert_transaction_executor_error!(result, err_sender_lacks_role());
}

/// A `set_attester` note sent by the `ATTEST_ADMIN` holder is CONSUMED: the transaction succeeds
/// and the faucet's `xReserveAttesters` map slot gains the enabled marker at the
/// creator-committed commitment key — proving the storage-param marshaling (parameters travel in
/// note storage, not note args) is correct for this builder too.
#[tokio::test]
async fn set_attester_note_consumes_on_0_17_faucet() {
    let (chain, faucet_id, _admin, _pauser, attest_admin, _other) =
        mock_chain_with_faucet_roles();
    let commitment = serial(200);
    let note =
        usdcx_admin_notes::set_attester(faucet_id, attest_admin, commitment, true, serial(106))
            .expect("building the set_attester note");

    let tx = chain
        .build_transaction(faucet_id)
        .unauthenticated_input_note(note.clone())
        .build()
        .expect("building the set_attester transaction")
        .execute()
        .await
        .expect("the 0.17 faucet must consume an ATTEST_ADMIN-sent set_attester note");

    let StorageSlotPatch::Map(delta) = tx
        .account_patch()
        .storage()
        .get(XReserveFaucetExtension::xreserve_attesters_slot())
        .expect("xReserveAttesters slot delta")
    else {
        panic!("xReserveAttesters must be a Map slot delta");
    };
    let written = delta
        .entries()
        .expect("map patch carries entries")
        .as_map()
        .get(&StorageMapKey::new(commitment))
        .copied()
        .expect("the commitment key must appear in the xReserveAttesters delta");
    assert_eq!(
        written,
        Word::from([Felt::from(1u32), Felt::ZERO, Felt::ZERO, Felt::ZERO]),
        "set_attester must write the enabled marker at the creator-committed commitment key",
    );
}

/// The same builder, sent by an account holding no role, PASSES network auth (the script is
/// allowlisted) but TRAPS at the procedure's own `ATTEST_ADMIN` gate.
#[tokio::test]
async fn set_attester_note_from_non_attest_admin_fails_on_0_17_faucet() {
    let (chain, faucet_id, _admin, _pauser, _attest_admin, other) =
        mock_chain_with_faucet_roles();
    let note = usdcx_admin_notes::set_attester(faucet_id, other, serial(201), true, serial(107))
        .expect("building the set_attester note");

    let result = chain
        .build_transaction(faucet_id)
        .unauthenticated_input_note(note.clone())
        .build()
        .expect("building the set_attester transaction")
        .execute()
        .await;

    assert_transaction_executor_error!(result, err_sender_lacks_role());
}

/// The current `ADMIN` can grant `ADMIN` itself to another account: the faucet consumes the
/// grant and writes the grantee into the role-membership map under `ADMIN`. This is how an admin
/// multisig gets its role on a deployed faucet: the faucet's existing admin sends exactly this
/// note.
#[tokio::test]
async fn admin_can_grant_admin_to_another_account() {
    let (chain, faucet_id, admin, _pauser, _attest_admin, other) = mock_chain_with_faucet_roles();
    let admin_role = usdcx_admin_notes::admin_role();

    let grant = usdcx_admin_notes::rbac(
        faucet_id,
        admin,
        RbacConfig::GrantRole { role: admin_role.clone(), account: other },
        serial(300),
    )
    .expect("building the ADMIN grant note");

    let tx = chain
        .build_transaction(faucet_id)
        .unauthenticated_input_note(grant)
        .build()
        .expect("building the grant transaction")
        .execute()
        .await
        .expect("the faucet must accept an ADMIN grant sent by the current ADMIN");

    let StorageSlotPatch::Map(delta) = tx
        .account_patch()
        .storage()
        .get(RoleBasedAccessControl::role_membership_slot())
        .expect("role-membership slot delta")
    else {
        panic!("role membership must be a Map slot delta");
    };
    // Same key layout `account_has_role` reads: [0, role, account suffix, account prefix].
    let key = StorageMapKey::new(Word::from([
        Felt::ZERO,
        admin_role.as_element(),
        other.suffix(),
        other.prefix().as_felt(),
    ]));
    let written = delta
        .entries()
        .expect("map patch carries entries")
        .as_map()
        .get(&key)
        .copied()
        .expect("the grantee's ADMIN membership key must appear in the delta");
    assert_eq!(written[0], Felt::ONE, "the grantee must be recorded as an ADMIN member");
}
