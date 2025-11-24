use alloc::boxed::Box;

use miden_client::{
    auth::SigningInputs,
    note::NoteType,
    testing::{
        common::{self, TestClientKeyStore},
        mock::MockRpcApi,
    },
    transaction::TransactionRequestBuilder,
};

use super::*;

const AUTH_SCHEME_ID: u8 = 0;

type TestMultisigClient = MultisigClient<TestClientKeyStore>;

#[tokio::test]
async fn multisig() {
    let (mut signer_a_client, _, authenticator_a) =
        miden_multisig_test_utils::create_test_client(std::env::temp_dir()).await;
    let (mut signer_b_client, _, authenticator_b) =
        miden_multisig_test_utils::create_test_client(std::env::temp_dir()).await;

    let (mut coordinator_client, mock_rpc_api, coordinator_keystore) =
        setup_multisig_client().await;

    let (_, secret_key_a) = common::insert_new_wallet(
        &mut signer_a_client,
        AccountStorageMode::Private,
        &authenticator_a,
        AUTH_SCHEME_ID,
    )
    .await
    .unwrap();
    let pub_key_commit_a = secret_key_a.public_key().to_commitment();

    let (_, secret_key_b) = common::insert_new_wallet(
        &mut signer_b_client,
        AccountStorageMode::Private,
        &authenticator_b,
        AUTH_SCHEME_ID,
    )
    .await
    .unwrap();
    let pub_key_commit_b = secret_key_b.public_key().to_commitment();

    let multisig_account = coordinator_client
        .setup_account(vec![pub_key_commit_a, pub_key_commit_b], 2.try_into().unwrap())
        .await
        .unwrap();

    // we insert the faucet to the coordinator client for convenience
    let (faucet_account, ..) = common::insert_new_fungible_faucet(
        coordinator_client.deref_mut(),
        AccountStorageMode::Public,
        &coordinator_keystore,
        AUTH_SCHEME_ID,
    )
    .await
    .unwrap();

    // mint a note to the multisig account
    let (_tx_id, note) = common::mint_note(
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
        .import_note(miden_client::note::NoteFile::NoteId(note.id()))
        .await
        .unwrap();

    // create a transaction to consume the note by the multisig account
    let salt = Word::empty();
    let tx_request = TransactionRequestBuilder::new()
        .auth_arg(salt)
        .build_consume_notes(vec![note.id()])
        .unwrap();

    // Propose the transaction (should fail with Unauthorized)
    let tx_summary = coordinator_client
        .propose_multisig_transaction(multisig_account.id(), tx_request.clone())
        .await
        .unwrap();

    let signing_inputs = SigningInputs::TransactionSummary(Box::new(tx_summary.clone()));

    let signature_a = authenticator_a
        .get_signature(pub_key_commit_a, &signing_inputs)
        .await
        .unwrap()
        .to_prepared_signature(Word::empty());

    let signature_b = authenticator_b
        .get_signature(pub_key_commit_b, &signing_inputs)
        .await
        .unwrap()
        .to_prepared_signature(Word::empty());

    let tx_result = coordinator_client
        .execute_multisig_transaction(
            multisig_account,
            tx_request,
            tx_summary,
            vec![Some(signature_a), Some(signature_b)],
        )
        .await;

    assert!(tx_result.is_ok());
}

async fn setup_multisig_client() -> (TestMultisigClient, MockRpcApi, TestClientKeyStore) {
    let (client, mock_rpc_api, keystore) =
        miden_multisig_test_utils::create_test_client(std::env::temp_dir()).await;

    (MultisigClient { client }, mock_rpc_api, keystore)
}
