use std::boxed::Box;
use std::env::temp_dir;
use std::sync::Arc;

use miden_client::Felt;
use miden_client::crypto::RpoRandomCoin;
use miden_client::note::{NoteExecutionMode, NoteTag, NoteType};
use miden_client::testing::NoteBuilder;
use miden_client::transaction::OutputNote;
use miden_testing::{MockChain, MockChainBuilder};
use rand::Rng;
use rand::rngs::StdRng;

use miden_client::DebugMode;
use miden_client::builder::ClientBuilder;
use miden_client::keystore::FilesystemKeyStore;
use miden_client::store::sqlite_store::SqliteStore;
use miden_client::testing::common::{TestClientKeyStore, create_test_store_path};
use miden_client::testing::mock::{MockClient, MockRpcApi};

// HELPERS
// ================================================================================================
// These already exist in miden-client, but are not exported publicly.
// See https://github.com/0xMiden/miden-client/pull/1255 which might resolve this.

pub async fn create_test_client_builder() -> (
    ClientBuilder<TestClientKeyStore>,
    MockRpcApi,
    FilesystemKeyStore<StdRng>,
) {
    let store = SqliteStore::new(create_test_store_path()).await.unwrap();
    let store = Arc::new(store);

    let mut rng = rand::rng();
    let coin_seed: [u64; 4] = rng.random();

    let rng = RpoRandomCoin::new(coin_seed.map(Felt::new).into());

    let keystore_path = temp_dir();
    let keystore = FilesystemKeyStore::new(keystore_path.clone()).unwrap();

    let rpc_api = MockRpcApi::new(Box::pin(create_prebuilt_mock_chain()).await);
    let arc_rpc_api = Arc::new(rpc_api.clone());

    let builder = ClientBuilder::new()
        .rpc(arc_rpc_api)
        .rng(Box::new(rng))
        .store(store)
        .filesystem_keystore(keystore_path.to_str().unwrap())
        .in_debug_mode(DebugMode::Enabled)
        .tx_graceful_blocks(None);

    (builder, rpc_api, keystore)
}

pub async fn create_test_client() -> (
    MockClient<FilesystemKeyStore<StdRng>>,
    MockRpcApi,
    FilesystemKeyStore<StdRng>,
) {
    let (builder, rpc_api, keystore) = Box::pin(create_test_client_builder()).await;
    let mut client = builder.build().await.unwrap();
    client.ensure_genesis_in_place().await.unwrap();

    (client, rpc_api, keystore)
}

pub async fn create_prebuilt_mock_chain() -> MockChain {
    let mut mock_chain_builder = MockChainBuilder::new();
    let mock_account = mock_chain_builder
        .add_existing_mock_account(miden_testing::Auth::IncrNonce)
        .unwrap();

    let note_first = NoteBuilder::new(
        mock_account.id(),
        RpoRandomCoin::new([0, 0, 0, 0].map(Felt::new).into()),
    )
    .tag(
        NoteTag::for_public_use_case(0, 0, NoteExecutionMode::Local)
            .unwrap()
            .into(),
    )
    .build()
    .unwrap();

    let note_second = NoteBuilder::new(
        mock_account.id(),
        RpoRandomCoin::new([0, 0, 0, 1].map(Felt::new).into()),
    )
    .note_type(NoteType::Private)
    .tag(NoteTag::for_local_use_case(0, 0).unwrap().into())
    .build()
    .unwrap();
    let mut mock_chain = mock_chain_builder.build().unwrap();

    // Block 1: Create first note
    mock_chain.add_pending_note(OutputNote::Full(note_first));
    mock_chain.prove_next_block().unwrap();

    // Block 2
    mock_chain.prove_next_block().unwrap();

    // Block 3
    mock_chain.prove_next_block().unwrap();

    // Block 4: Create second note
    mock_chain.add_pending_note(OutputNote::Full(note_second.clone()));
    mock_chain.prove_next_block().unwrap();

    let transaction = Box::pin(
        mock_chain
            .build_tx_context(mock_account, &[note_second.id()], &[])
            .unwrap()
            .build()
            .unwrap()
            .execute(),
    )
    .await
    .unwrap();

    // Block 5: Consume (nullify) second note
    mock_chain
        .add_pending_executed_transaction(&transaction)
        .unwrap();
    mock_chain.prove_next_block().unwrap();

    mock_chain
}
