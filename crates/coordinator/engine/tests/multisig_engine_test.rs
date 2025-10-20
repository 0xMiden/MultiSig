//! integration tests for miden-multisig-coordinator-engine

use core::{
    num::{NonZeroU32, NonZeroUsize},
    time::Duration,
};

use std::{
    path::Path,
    sync::{Arc, LazyLock, Mutex},
};

use diesel::{Connection, PgConnection, RunQueryDsl};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness};
use miden_client::{
    Client, DebugMode, Felt, Word,
    account::{
        Account, AccountBuilder, AccountIdAddress, AccountStorageMode, AccountType,
        AddressInterface, NetworkId,
        component::{AuthRpoFalcon512, BasicFungibleFaucet, BasicWallet},
    },
    asset::{FungibleAsset, TokenSymbol},
    auth::AuthSecretKey,
    builder::ClientBuilder,
    crypto::SecretKey,
    keystore::FilesystemKeyStore,
    note::NoteType,
    rpc::{Endpoint, TonicRpcClient},
    transaction::TransactionRequestBuilder,
};
use miden_multisig_coordinator_engine::{
    MultisigClientRuntimeConfig, MultisigEngine, Started,
    request::{
        AddSignatureRequest, CreateMultisigAccountRequest, GetConsumableNotesRequest,
        ProposeMultisigTxRequest,
    },
    response::{CreateMultisigAccountResponseDissolved, ProposeMultisigTxResponseDissolved},
};
use miden_multisig_coordinator_store::MultisigStore;
use rand::{RngCore, rngs::StdRng};
use tempfile::TempDir;
use testcontainers::{ContainerAsync, ImageExt, runners::AsyncRunner};
use testcontainers_modules::postgres::Postgres;
use tokio::{runtime::Runtime, sync::OnceCell};

const MIGRATIONS: EmbeddedMigrations = diesel_migrations::embed_migrations!("../store/migrations");

static POSTGRES_CONTAINER: OnceCell<ContainerAsync<Postgres>> = OnceCell::const_new();

static DB_COUNTER: LazyLock<Mutex<u32>> = LazyLock::new(|| Mutex::new(0));

async fn pg_container() -> &'static ContainerAsync<Postgres> {
    POSTGRES_CONTAINER
        .get_or_init(|| async {
            Postgres::default()
                .with_tag("18-alpine")
                .start()
                .await
                .expect("failed to start postgres container")
        })
        .await
}

#[tokio::test]
async fn single_note_consumption_works_using_multisig_engine_to_get_consumable_notes() {
    // Arrange
    let temp_dir = TempDir::new().expect("failed to create temporary directory");
    let temp_dir = temp_dir.path();

    let (mut ff_client, ff_account) =
        setup_fungible_faucet_client(&temp_dir.join("ff"), "INC", 8, 5_000_000).await;

    let (_, alice_account, alice_sk) = setup_regular_account_client(&temp_dir.join("alice")).await;

    let (_, bob_account, bob_sk) = setup_regular_account_client(&temp_dir.join("bob")).await;

    let (_, charlie_account, charlie_sk) =
        setup_regular_account_client(&temp_dir.join("charlie")).await;

    tokio::time::sleep(Duration::from_secs(5)).await;

    let engine = start_testnet_multisig_engine(&temp_dir.join("multisig")).await;

    let approvers = {
        let alice_addr = AccountIdAddress::new(alice_account.id(), AddressInterface::BasicWallet);
        let bob_addr = AccountIdAddress::new(bob_account.id(), AddressInterface::BasicWallet);
        let charlie_addr =
            AccountIdAddress::new(charlie_account.id(), AddressInterface::BasicWallet);

        vec![alice_addr, bob_addr, charlie_addr]
    };

    let pub_key_commits = vec![alice_sk.public_key(), bob_sk.public_key(), charlie_sk.public_key()];

    let create_account_request = CreateMultisigAccountRequest::builder()
        .threshold(NonZeroU32::new(2).unwrap())
        .approvers(approvers)
        .pub_key_commits(pub_key_commits)
        .build()
        .unwrap();

    let CreateMultisigAccountResponseDissolved { miden_account: multisig_account, .. } =
        engine.create_multisig_account(create_account_request).await.unwrap().dissolve();

    let asset = FungibleAsset::new(ff_account.id(), 1_150_000).unwrap();

    let mint_request = TransactionRequestBuilder::new()
        .build_mint_fungible_asset(asset, multisig_account.id(), NoteType::Public, ff_client.rng())
        .unwrap();

    ff_client.sync_state().await.unwrap();
    let tx_result = ff_client.new_transaction(ff_account.id(), mint_request).await.unwrap();

    ff_client.submit_transaction(tx_result).await.unwrap();

    tokio::time::sleep(Duration::from_secs(5)).await;

    let consume_notes_tx_request = {
        let note_ids = engine
            .get_consumable_notes(GetConsumableNotesRequest::builder().build())
            .await
            .unwrap()
            .into_iter()
            .map(|(nr, _)| nr.id())
            .collect();

        TransactionRequestBuilder::new().build_consume_notes(note_ids).unwrap()
    };

    let propose_request = ProposeMultisigTxRequest::builder()
        .address(AccountIdAddress::new(multisig_account.id(), AddressInterface::BasicWallet))
        .tx_request(consume_notes_tx_request)
        .build();

    let ProposeMultisigTxResponseDissolved { tx_id, tx_summary } =
        engine.propose_multisig_tx(propose_request).await.unwrap().dissolve();

    // Act
    let tx_summary_commitment = tx_summary.to_commitment();

    let add_sig_request = AddSignatureRequest::builder()
        .tx_id(tx_id.clone())
        .approver(AccountIdAddress::new(alice_account.id(), AddressInterface::BasicWallet))
        .signature(alice_sk.sign(tx_summary_commitment))
        .build();

    let tx_result = engine.add_signature(add_sig_request).await.unwrap();
    assert!(tx_result.is_none());

    let add_sig_request = AddSignatureRequest::builder()
        .tx_id(tx_id)
        .approver(AccountIdAddress::new(charlie_account.id(), AddressInterface::BasicWallet))
        .signature(charlie_sk.sign(tx_summary_commitment))
        .build();

    let tx_result = engine.add_signature(add_sig_request).await.unwrap();

    tokio::time::sleep(Duration::from_secs(5)).await;

    // Assert
    assert!(tx_result.is_some());

    let asset_balance = {
        let (mut client, _) = setup_testnet_client(&temp_dir.join("external")).await;

        client.import_account_by_id(multisig_account.id()).await.unwrap();
        client.sync_state().await.unwrap();

        let imported_multisig_account_record =
            client.get_account(multisig_account.id()).await.unwrap().unwrap();

        let imported_multisig_account = imported_multisig_account_record.account();

        imported_multisig_account.vault().get_balance(ff_account.id()).unwrap()
    };

    assert_eq!(asset_balance, asset.amount());
}

#[tokio::test]
async fn single_note_consumption_works_without_using_multisig_engine_to_get_consumable_notes() {
    // Arrange
    let temp_dir = TempDir::new().expect("failed to create temporary directory");
    let temp_dir = temp_dir.path();

    let (mut ff_client, ff_account) =
        setup_fungible_faucet_client(&temp_dir.join("ff"), "INC", 8, 5_000_000).await;

    let (_, alice_account, alice_sk) = setup_regular_account_client(&temp_dir.join("alice")).await;

    let (_, bob_account, bob_sk) = setup_regular_account_client(&temp_dir.join("bob")).await;

    let (_, charlie_account, charlie_sk) =
        setup_regular_account_client(&temp_dir.join("charlie")).await;

    let engine = start_testnet_multisig_engine(&temp_dir.join("multisig")).await;

    let approvers = {
        let alice_addr = AccountIdAddress::new(alice_account.id(), AddressInterface::BasicWallet);
        let bob_addr = AccountIdAddress::new(bob_account.id(), AddressInterface::BasicWallet);
        let charlie_addr =
            AccountIdAddress::new(charlie_account.id(), AddressInterface::BasicWallet);

        vec![alice_addr, bob_addr, charlie_addr]
    };

    let pub_key_commits = vec![alice_sk.public_key(), bob_sk.public_key(), charlie_sk.public_key()];

    let create_account_request = CreateMultisigAccountRequest::builder()
        .threshold(NonZeroU32::new(2).unwrap())
        .approvers(approvers)
        .pub_key_commits(pub_key_commits)
        .build()
        .unwrap();

    let CreateMultisigAccountResponseDissolved { miden_account: multisig_account, .. } =
        engine.create_multisig_account(create_account_request).await.unwrap().dissolve();

    let asset = FungibleAsset::new(ff_account.id(), 1_150_000).unwrap();

    let mint_request = TransactionRequestBuilder::new()
        .build_mint_fungible_asset(asset, multisig_account.id(), NoteType::Public, ff_client.rng())
        .unwrap();

    ff_client.sync_state().await.unwrap();
    let tx_result = ff_client.new_transaction(ff_account.id(), mint_request.clone()).await.unwrap();

    ff_client.submit_transaction(tx_result).await.unwrap();

    tokio::time::sleep(Duration::from_secs(5)).await;

    // submit one successful transaction of multisig to the network so that import account works
    {
        let propose_request = ProposeMultisigTxRequest::builder()
            .address(AccountIdAddress::new(multisig_account.id(), AddressInterface::BasicWallet))
            .tx_request(TransactionRequestBuilder::new().build().unwrap())
            .build();

        let ProposeMultisigTxResponseDissolved { tx_id, tx_summary } =
            engine.propose_multisig_tx(propose_request).await.unwrap().dissolve();

        let tx_summary_commit = tx_summary.to_commitment();

        let alice_add_signature_request = AddSignatureRequest::builder()
            .tx_id(tx_id.clone())
            .approver(AccountIdAddress::new(alice_account.id(), AddressInterface::BasicWallet))
            .signature(alice_sk.sign(tx_summary_commit))
            .build();
        engine.add_signature(alice_add_signature_request).await.unwrap();

        let bob_add_signature_request = AddSignatureRequest::builder()
            .tx_id(tx_id)
            .approver(AccountIdAddress::new(bob_account.id(), AddressInterface::BasicWallet))
            .signature(bob_sk.sign(tx_summary_commit))
            .build();
        engine.add_signature(bob_add_signature_request).await.unwrap();

        tokio::time::sleep(Duration::from_secs(5)).await;
    }

    let consume_notes_tx_request = {
        let (mut client, _) = setup_testnet_client(&temp_dir.join("import_get_notes")).await;

        client.import_account_by_id(multisig_account.id()).await.unwrap();
        client.sync_state().await.unwrap();

        let note_ids: Vec<_> = client
            .get_consumable_notes(Some(multisig_account.id()))
            .await
            .unwrap()
            .into_iter()
            .map(|(nr, _)| nr.id())
            .collect();

        TransactionRequestBuilder::new()
            .auth_arg(Word::new([Felt::new(10); 4]))
            .build_consume_notes(note_ids)
            .unwrap()
    };

    let propose_request = ProposeMultisigTxRequest::builder()
        .address(AccountIdAddress::new(multisig_account.id(), AddressInterface::BasicWallet))
        .tx_request(consume_notes_tx_request)
        .build();

    let ProposeMultisigTxResponseDissolved { tx_id, tx_summary } =
        engine.propose_multisig_tx(propose_request).await.unwrap().dissolve();

    // Act
    let tx_summary_commitment = tx_summary.to_commitment();

    let add_sig_request = AddSignatureRequest::builder()
        .tx_id(tx_id.clone())
        .approver(AccountIdAddress::new(alice_account.id(), AddressInterface::BasicWallet))
        .signature(alice_sk.sign(tx_summary_commitment))
        .build();

    let tx_result = engine.add_signature(add_sig_request).await.unwrap();
    assert!(tx_result.is_none());

    let add_sig_request = AddSignatureRequest::builder()
        .tx_id(tx_id)
        .approver(AccountIdAddress::new(charlie_account.id(), AddressInterface::BasicWallet))
        .signature(charlie_sk.sign(tx_summary_commitment))
        .build();

    let tx_result = engine.add_signature(add_sig_request).await.unwrap();

    tokio::time::sleep(Duration::from_secs(5)).await;

    // Assert
    assert!(tx_result.is_some());

    let asset_balance = {
        let (mut client, _) = setup_testnet_client(&temp_dir.join("external")).await;

        client.import_account_by_id(multisig_account.id()).await.unwrap();
        client.sync_state().await.unwrap();

        let imported_multisig_account_record =
            client.get_account(multisig_account.id()).await.unwrap().unwrap();

        let imported_multisig_account = imported_multisig_account_record.account();

        imported_multisig_account.vault().get_balance(ff_account.id()).unwrap()
    };

    assert_eq!(asset_balance, asset.amount());
}

async fn setup_fungible_faucet_client(
    temp_dir: &Path,
    symbol: &str,
    decimals: u8,
    max_supply: u64,
) -> (Client<FilesystemKeyStore<StdRng>>, Account) {
    let (mut client, keystore) = setup_testnet_client(temp_dir).await;

    let mut init_seed = [0u8; 32];
    client.rng().fill_bytes(&mut init_seed);

    let symbol = TokenSymbol::new(symbol).unwrap();
    let max_supply = Felt::new(max_supply);

    let sk = SecretKey::with_rng(client.rng());

    let (account, seed) = AccountBuilder::new(init_seed)
        .account_type(AccountType::FungibleFaucet)
        .storage_mode(miden_client::account::AccountStorageMode::Public)
        .with_auth_component(AuthRpoFalcon512::new(sk.public_key()))
        .with_component(BasicFungibleFaucet::new(symbol, decimals, max_supply).unwrap())
        .build()
        .unwrap();

    client.add_account(&account, Some(seed), false).await.unwrap();
    keystore.add_key(&AuthSecretKey::RpoFalcon512(sk)).unwrap();

    (client, account)
}

async fn setup_regular_account_client(
    temp_dir: &Path,
) -> (Client<FilesystemKeyStore<StdRng>>, Account, SecretKey) {
    let (mut client, keystore) = setup_testnet_client(temp_dir).await;

    let mut init_seed = [0u8; 32];
    client.rng().fill_bytes(&mut init_seed);

    let sk = SecretKey::with_rng(client.rng());

    let (account, seed) = AccountBuilder::new(init_seed)
        .account_type(AccountType::RegularAccountUpdatableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthRpoFalcon512::new(sk.public_key()))
        .with_component(BasicWallet)
        .build()
        .unwrap();

    client.add_account(&account, Some(seed), false).await.unwrap();
    keystore.add_key(&AuthSecretKey::RpoFalcon512(sk.clone())).unwrap();

    (client, account, sk)
}

async fn setup_testnet_client(
    temp_dir: &Path,
) -> (Client<FilesystemKeyStore<StdRng>>, FilesystemKeyStore<StdRng>) {
    let keystore =
        FilesystemKeyStore::new(temp_dir.join("keystore")).expect("failed to initialize keystore");

    let client = ClientBuilder::new()
        .rpc(Arc::new(TonicRpcClient::new(&Endpoint::testnet(), 10_000)))
        .sqlite_store(temp_dir.join("store").as_os_str().to_str().unwrap())
        .authenticator(keystore.clone().into())
        .in_debug_mode(DebugMode::Enabled)
        .build()
        .await
        .expect("failed to build miden client");

    (client, keystore)
}

async fn start_testnet_multisig_engine(temp_dir: &Path) -> MultisigEngine<Started> {
    let db_url = setup_test_db().await;

    let multisig_store =
        miden_multisig_coordinator_store::establish_pool(db_url, NonZeroUsize::MIN)
            .await
            .map(MultisigStore::new)
            .expect("failed to initialize multisig store");

    let engine = MultisigEngine::new(NetworkId::Testnet, multisig_store);

    let config = MultisigClientRuntimeConfig::builder()
        .node_url("https://rpc.testnet.miden.io:443".parse().unwrap())
        .store_path(temp_dir.join("store"))
        .keystore_path(temp_dir.join("keystore"))
        .timeout(Duration::from_secs(10))
        .build();

    engine.start_multisig_client_runtime(Runtime::new().expect("failed to create tokio runtime"), config)
}

async fn setup_test_db() -> String {
    let container = pg_container().await;

    let db_name = {
        let mut counter = DB_COUNTER.lock().unwrap();
        *counter += 1;
        format!("test_db_{}", *counter)
    };

    let host = container.get_host().await.expect("failed to get host");

    let port = container.get_host_port_ipv4(5432).await.expect("failed to get port");

    let admin_url = format!("postgres://postgres:postgres@{}:{}/postgres", host, port);

    let mut admin_conn =
        PgConnection::establish(&admin_url).expect("failed to connect to postgres");

    diesel::sql_query(format!("CREATE DATABASE {db_name}"))
        .execute(&mut admin_conn)
        .expect("failed to create test database");

    let test_db_url = format!("postgres://postgres:postgres@{}:{}/{}", host, port, db_name);

    PgConnection::establish(&test_db_url)
        .expect("failed to connect to test database")
        .run_pending_migrations(MIGRATIONS)
        .expect("failed to run migrations");

    test_db_url
}
