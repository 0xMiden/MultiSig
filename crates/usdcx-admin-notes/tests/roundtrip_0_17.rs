//! Round-trip guard (Task 7 of the 0.17 port): proves a note this crate BUILDS is actually
//! CONSUMABLE — executes and is accepted — by a real 0.17 USDCx faucet, and that its on-chain RBAC
//! gate is real, not merely mirrored by this crate's own `account_has_role` read-back.
//!
//! Builds a production-shaped faucet (`xusdc-encoding`'s `XReserveStablecoinBuilder` composition,
//! the same one `build_faucet_account` assembles) inside a `miden-testing::MockChain`, with the
//! acting accounts granted `ADMIN` / `DOM_PAUSER`, and executes notes built by
//! `usdcx_admin_notes::{set_max_supply, pause}` against it — both the success path (role holder)
//! and the on-chain rejection (non-holder).
//!
//! See `.superpowers/sdd/2026-09-30-usdcx-admin-notes-0.17-port/task-7-brief.md`.

use miden_protocol::account::{StorageSlotName, StorageSlotPatch};
use miden_protocol::errors::MasmError;
use miden_protocol::transaction::ExecutedTransaction;
use miden_protocol::{Felt, Word};
use miden_standards::account::access::PausableStorage;
use miden_standards::account::faucets::FungibleFaucet;
use miden_testing::assert_transaction_executor_error;

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
    let (chain, faucet_id, admin, _pauser, _other) = mock_chain_with_faucet_roles();
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
    let (chain, faucet_id, _admin, _pauser, other) = mock_chain_with_faucet_roles();
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
    let (chain, faucet_id, _admin, pauser, _other) = mock_chain_with_faucet_roles();
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
    let (chain, faucet_id, _admin, _pauser, other) = mock_chain_with_faucet_roles();
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
