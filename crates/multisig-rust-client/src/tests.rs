use alloc::boxed::Box;

use miden_objects::note::NoteType;
use miden_tx::auth::SigningInputs;

use super::*;
use miden_client::testing::common::{
    TestClientKeyStore, create_test_client, insert_new_fungible_faucet, insert_new_wallet,
    mint_note,
};
use miden_client::testing::mock::MockRpcApi;
use miden_client::transaction::TransactionRequestBuilder;

type TestMultisigClient = MultisigClient<TestClientKeyStore>;

async fn setup_multisig_client() -> (TestMultisigClient, MockRpcApi, TestClientKeyStore) {
    let (client, mock_rpc_api, keystore) = create_test_client().await;
    (MultisigClient::new(client), mock_rpc_api, keystore)
}

#[tokio::test]
async fn multisig() {
    let (mut signer_a_client, _, authenticator_a) = create_test_client().await;
    let (mut signer_b_client, _, authenticator_b) = create_test_client().await;

    let (mut coordinator_client, mock_rpc_api, coordinator_keystore) =
        setup_multisig_client().await;

    let (_, _, secret_key_a) = insert_new_wallet(
        &mut signer_a_client,
        AccountStorageMode::Private,
        &authenticator_a,
    )
    .await
    .unwrap();
    let pub_key_a = secret_key_a.public_key();

    let (_, _, secret_key_b) = insert_new_wallet(
        &mut signer_b_client,
        AccountStorageMode::Private,
        &authenticator_b,
    )
    .await
    .unwrap();
    let pub_key_b = secret_key_b.public_key();

    let (multisig_account, seed) = coordinator_client.setup_account(vec![pub_key_a, pub_key_b], 2);

    coordinator_client
        .add_account(&multisig_account, Some(seed), false)
        .await
        .unwrap();

    // we insert the faucet to the coordinator client for convenience
    let (faucet_account, ..) = insert_new_fungible_faucet(
        coordinator_client.deref_mut(),
        AccountStorageMode::Public,
        &coordinator_keystore,
    )
    .await
    .unwrap();

    // mint a note to the multisig account
    let (_tx_id, note) = mint_note(
        &mut coordinator_client,
        multisig_account.id(),
        faucet_account.id(),
        NoteType::Public,
    )
    .await;

    mock_rpc_api.prove_block();
    // TODO why do we need a second `prove_block`?
    mock_rpc_api.prove_block();
    coordinator_client.sync_state().await.unwrap();

    coordinator_client
        .import_note(miden_objects::note::NoteFile::NoteId(note.id()))
        .await
        .unwrap();

    // create a transaction to consume the note by the multisig account
    let salt = Word::empty();
    let tx_request = TransactionRequestBuilder::new()
        .auth_arg(salt)
        .build_consume_notes(vec![note.id()])
        // .build()
        .unwrap();

    // Propose the transaction (should fail with Unauthorized)
    let tx_summary = coordinator_client
        .propose_multisig_transaction(multisig_account.id(), tx_request.clone())
        .await
        .unwrap();

    let signing_inputs = SigningInputs::TransactionSummary(Box::new(tx_summary.clone()));

    let signature_a = authenticator_a
        .get_signature(pub_key_a.into(), &signing_inputs)
        .await
        .unwrap();
    let signature_b = authenticator_b
        .get_signature(pub_key_b.into(), &signing_inputs)
        .await
        .unwrap();

    let tx_result = coordinator_client
        .new_multisig_transaction(
            multisig_account,
            tx_request,
            tx_summary,
            vec![Some(signature_a), Some(signature_b)],
        )
        .await;

    assert!(tx_result.is_ok());
}
