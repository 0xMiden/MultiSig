//! Test utilities for Miden multisig components.
//!
//! This crate provides helpers to set up a ready-to-use `MockClient` and a prebuilt mock
//! chain for integration and end-to-end tests across this workspace.
//!
//! The APIs are thin wrappers around `miden-client` testing facilities while exposing
//! a stable interface for this repository's tests.

use std::{path::Path, sync::Arc};

use miden_client::{
    DebugMode, Felt,
    builder::ClientBuilder,
    crypto::RpoRandomCoin,
    keystore::FilesystemKeyStore,
    note::{NoteExecutionMode, NoteTag, NoteType},
    testing::{
        NoteBuilder,
        common::{TestClientKeyStore, create_test_store_path},
        mock::{MockClient, MockRpcApi},
    },
    transaction::OutputNote,
};
use miden_client_sqlite_store::SqliteStore;
use miden_testing::{MockChain, MockChainBuilder};
use rand::{Rng, rngs::StdRng};

// HELPERS
// ================================================================================================
// These already exist in miden-client, but are not exported publicly.
// See https://github.com/0xMiden/miden-client/pull/1255 which might resolve this.

/// Create a ready-to-use `MockClient` preconfigured with a filesystem keystore and mock RPC.
///
/// Returns the client, the associated `MockRpcApi`, and the `FilesystemKeyStore`. This is
/// useful in integration tests where you need both the client and access to the mock chain.
///
/// The `keystore_path` controls where keys are stored on disk during the test run.
pub async fn create_test_client<P>(
    keystore_path: P,
) -> (MockClient<FilesystemKeyStore<StdRng>>, MockRpcApi, FilesystemKeyStore<StdRng>)
where
    P: AsRef<Path>,
{
    let (builder, rpc_api, keystore) = Box::pin(create_test_client_builder(keystore_path)).await;
    let mut client = builder.build().await.unwrap();
    client.ensure_genesis_in_place().await.unwrap();

    (client, rpc_api, keystore)
}

async fn create_test_client_builder<P>(
    keystore_path: P,
) -> (ClientBuilder<TestClientKeyStore>, MockRpcApi, FilesystemKeyStore<StdRng>)
where
    P: AsRef<Path>,
{
    let store = SqliteStore::new(create_test_store_path()).await.unwrap();
    let store = Arc::new(store);

    let mut rng = rand::rng();
    let coin_seed: [u64; 4] = rng.random();

    let rng = RpoRandomCoin::new(coin_seed.map(Felt::new).into());

    let keystore = FilesystemKeyStore::new(keystore_path.as_ref().into()).unwrap();

    let rpc_api = MockRpcApi::new(Box::pin(create_prebuilt_mock_chain()).await);
    let arc_rpc_api = Arc::new(rpc_api.clone());

    let builder = ClientBuilder::new()
        .rpc(arc_rpc_api)
        .rng(Box::new(rng))
        .store(store)
        .filesystem_keystore(keystore_path.as_ref().to_str().unwrap())
        .in_debug_mode(DebugMode::Enabled)
        .tx_graceful_blocks(None);

    (builder, rpc_api, keystore)
}

async fn create_prebuilt_mock_chain() -> MockChain {
    let mut mock_chain_builder = MockChainBuilder::new();
    let mock_account = mock_chain_builder
        .add_existing_mock_account(miden_testing::Auth::IncrNonce)
        .unwrap();

    let note_first =
        NoteBuilder::new(mock_account.id(), RpoRandomCoin::new([0, 0, 0, 0].map(Felt::new).into()))
            .tag(NoteTag::for_public_use_case(0, 0, NoteExecutionMode::Local).unwrap().into())
            .build()
            .unwrap();
    mock_chain_builder.add_output_note(OutputNote::Full(note_first));

    let note_second =
        NoteBuilder::new(mock_account.id(), RpoRandomCoin::new([0, 0, 0, 1].map(Felt::new).into()))
            .note_type(NoteType::Private)
            .tag(NoteTag::for_local_use_case(0, 0).unwrap().into())
            .build()
            .unwrap();
    mock_chain_builder.add_output_note(OutputNote::Full(note_second.clone()));

    let mut mock_chain = mock_chain_builder.build().unwrap();

    // Block 1
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

    // Block 2: Consume (nullify) second note
    mock_chain.add_pending_executed_transaction(&transaction).unwrap();
    mock_chain.prove_next_block().unwrap();

    mock_chain
}
