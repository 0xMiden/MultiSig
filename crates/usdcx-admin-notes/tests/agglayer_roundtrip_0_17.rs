//! Round-trip guard for the AggLayer bridge: the RBAC and pause notes this crate builds are
//! consumed by a deployed-equivalent 0.17 bridge (the published `miden-agglayer` crate's own
//! builder), and its role gates are enforced on chain.

use miden_protocol::account::{Account, StorageSlotName, StorageSlotPatch};
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

/// A grant is gated on the target role's admin role, which has its own assertion message.
fn err_sender_lacks_role_admin() -> MasmError {
    MasmError::from_static_str("note sender does not hold the role's admin role")
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
    assert_transaction_executor_error!(result, err_sender_lacks_role_admin());
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

    let set_admin = usdcx_admin_notes::rbac_set_admin(
        bridge_id,
        admin,
        pauser_role.clone(),
        Some(fee_role),
        serial(206),
    )
    .unwrap();
    chain
        .build_transaction(bridge_id)
        .unauthenticated_input_note(set_admin)
        .build()
        .unwrap()
        .execute()
        .await
        .expect("the bridge must consume an ADMIN-sent set-role-admin");

    let renounce =
        usdcx_admin_notes::rbac_renounce(bridge_id, pauser, pauser_role.clone(), serial(207))
            .unwrap();
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
