//! Multisig client runtime for running the `!Send + !Sync` [`MultisigClient`] client.
//!
//! This module provides a dedicated thread environment where the [`MultisigClient`]
//! can operate safely despite not being thread-safe. It uses tokio's [`LocalSet`] to run
//! the client's async operations on a single thread, while providing a message-passing
//! interface for external communication.
//!
//! ## Architecture
//!
//! The runtime operates as follows:
//!
//! ```text
//!  External Thread (Axum)            Runtime Thread (LocalSet)
//! ┌───────────────────────┐         ┌───────────────────────────────┐
//! │ MultisigEngine        │         │ MultisigClient (!Send + !Sync)│
//! │                       │         │                               │
//! │ mpsc::UnboundedSender ┼─────────│──> mpsc::UnboundedReceiver    │
//! │                       │         │                               │
//! │ oneshot::Receiver <───┼─────────┤─── oneshot::Sender            │
//! └───────────────────────┘         └───────────────────────────────┘
//! ```
//!
//! 1. A [`MultisigClientRuntimeMsg`] is sent from an external thread using a
//!    [`mpsc::UnboundedSender`].
//! 2. The runtime thread receives the message through the [`mpsc::UnboundedReceiver`].
//! 3. The runtime performs the blockchain operation using the [`MultisigClient`].
//! 4. The runtime sends the result back via the [`oneshot::Sender`] that was sent in the
//!    [`MultisigClientRuntimeMsg`].
//!
//! ## Thread Safety
//!
//! The runtime ensures thread safety by:
//! - Running the `!Send + !Sync` client on a single dedicated thread
//! - Using [`LocalSet`] to prevent the tokio runtime from moving tasks across threads
//! - Communicating only via thread-safe channels (`mpsc` and `oneshot`)
//!
//! [`MultisigClient`]: miden_multisig_client::MultisigClient
//! [`LocalSet`]: tokio::task::LocalSet

pub mod msg;

mod error;

pub use self::error::MultisigClientRuntimeError;

use core::time::Duration;

use std::{
    path::PathBuf,
    sync::Arc,
    thread::{self, JoinHandle},
};

use bon::Builder;
use miden_client::{
    account::AccountIdAddress, auth::TransactionAuthenticator, builder::ClientBuilder,
    keystore::FilesystemKeyStore,
};
use miden_multisig_client::MultisigClient;
use tokio::{runtime::Runtime, sync::mpsc, task::LocalSet};
use url::Url;

use self::{
    error::Result,
    msg::{
        CreateMultisigAccount, CreateMultisigAccountDissolved, GetConsumableNotes,
        GetConsumableNotesDissolved, MultisigClientRuntimeMsg, ProcessMultisigTx,
        ProcessMultisigTxDissolved, ProposeMultisigTx, ProposeMultisigTxDissolved,
    },
};

/// Spawns a new multisig client runtime thread.
///
/// This function creates a dedicated thread that runs the [`MultisigClient`] using a tokio
/// [`LocalSet`]. The thread listens for messages on the provided channel and processes
/// them using the [`MultisigClient`].
///
/// # Returns
///
/// A [`JoinHandle`] for the spawned thread, which can be used to wait for thread completion
/// or detect panics.
///
/// # Thread Lifecycle
///
/// The thread runs until:
/// - A [`MultisigClientRuntimeMsg::Shutdown`](MultisigClientRuntimeMsg::Shutdown) message is received
/// - An unrecoverable error occurs
/// - The message channel is closed
///
/// [`MultisigClient`]: miden_multisig_client::MultisigClient
/// [`LocalSet`]: tokio::task::LocalSet
#[tracing::instrument(skip_all, fields(?config))]
pub fn spawn_new<A>(
    rt: Runtime,
    msg_receiver: mpsc::UnboundedReceiver<MultisigClientRuntimeMsg>,
    tracking_multisig_accounts: A,
    config: MultisigClientRuntimeConfig,
) -> JoinHandle<Result<()>>
where
    A: Iterator<Item = AccountIdAddress> + Send + 'static,
{
    thread::spawn(move || {
        let local = LocalSet::new();
        let fut = run_multisig_client_runtime(msg_receiver, tracking_multisig_accounts, config);
        let local_runtime = local.run_until(fut);
        rt.block_on(local_runtime)
            .inspect_err(|e| tracing::error!("failed to run multisig client runtime: {e}"))
    })
}

/// Configuration for the multisig client runtime.
///
/// Contains all the parameters needed to initialize and connect to the node.
///
/// # Fields
///
/// * `node_url` - URL of the node to connect to
/// * `store_path` - Path to the database for multisig client state
/// * `keystore_path` - Path to the filesystem keystore for cryptographic keys
/// * `timeout` - Network request timeout duration
#[derive(Debug, Builder)]
pub struct MultisigClientRuntimeConfig {
    node_url: Url,
    store_path: PathBuf,
    keystore_path: PathBuf,
    timeout: Duration,
}

#[tracing::instrument(skip_all)]
async fn run_multisig_client_runtime<A>(
    mut msg_receiver: mpsc::UnboundedReceiver<MultisigClientRuntimeMsg>,
    tracking_multisig_accounts: A,
    MultisigClientRuntimeConfig {
        node_url,
        store_path,
        keystore_path,
        timeout,
    }: MultisigClientRuntimeConfig,
) -> Result<()>
where
    A: Iterator<Item = AccountIdAddress>,
{
    let keystore = FilesystemKeyStore::new(keystore_path)
        .map_err(|e| MultisigClientRuntimeError::other(e.to_string()))?;

    let endpoint = node_url.as_str().trim_end_matches('/').try_into().map_err(|e| {
        MultisigClientRuntimeError::other(format!("failed to parse node url {node_url}: {e}"))
    })?;

    let store_path = store_path
        .to_str()
        .ok_or(MultisigClientRuntimeError::other("invalid store path"))?;

    let mut client = ClientBuilder::new()
        .tonic_rpc_client(&endpoint, Some(timeout.as_millis() as u64))
        .authenticator(Arc::new(keystore))
        .sqlite_store(store_path)
        .build()
        .await
        .map(MultisigClient::new)?;

    client.sync_state().await?;

    for account_id in tracking_multisig_accounts.map(|address| address.id()) {
        let _ = client
            .import_account_by_id(account_id)
            .await
            .inspect_err(|e| tracing::error!("failed to track multisig account {account_id}: {e}"));
    }

    // TODO: convey the error in a better way to the caller
    while let Some(msg) = msg_receiver.recv().await {
        match msg {
            MultisigClientRuntimeMsg::Shutdown => {
                tracing::info!("received shutdown msg, stopping multisig client runtime");
                break;
            },
            MultisigClientRuntimeMsg::GetConsumableNotes(msg) => {
                let _ = handle_get_consumable_notes(&mut client, msg)
                    .await
                    .inspect_err(|e| tracing::error!("failed to handle get consumable notes: {e}"));
            },
            MultisigClientRuntimeMsg::CreateMultisigAccount(msg) => {
                let _ = handle_create_multisig_account(&mut client, msg).await.inspect_err(|e| {
                    tracing::error!("failed to handle create multisig account: {e}")
                });
            },
            MultisigClientRuntimeMsg::ProposeMultisigTx(msg) => {
                let _ = handle_propose_multisig_tx(&mut client, msg)
                    .await
                    .inspect_err(|e| tracing::error!("failed to handle propose multisig tx: {e}"));
            },
            MultisigClientRuntimeMsg::ProcessMultisigTx(msg) => {
                let _ = handle_process_multisig_tx(&mut client, msg)
                    .await
                    .inspect_err(|e| tracing::error!("failed to handle process multisig tx: {e}"));
            },
        }
    }

    tracing::info!("shutting down multisig client runtime");

    Ok(())
}

#[tracing::instrument(skip_all)]
async fn handle_create_multisig_account<AUTH>(
    client: &mut MultisigClient<AUTH>,
    msg: CreateMultisigAccount,
) -> Result<()>
where
    AUTH: TransactionAuthenticator + Sync + 'static,
{
    client.sync_state().await?;

    let CreateMultisigAccountDissolved { threshold, approvers, sender } = msg.dissolve();

    let account = client.setup_account(approvers, threshold.get()).await;

    let _ = sender
        .send(account)
        .inspect_err(|_| tracing::error!("oneshot sender failed to send new multisig account"));

    Ok(())
}

#[tracing::instrument(skip_all)]
async fn handle_get_consumable_notes<AUTH>(
    client: &mut MultisigClient<AUTH>,
    msg: GetConsumableNotes,
) -> Result<()>
where
    AUTH: TransactionAuthenticator + Sync + 'static,
{
    client.sync_state().await?;

    let GetConsumableNotesDissolved { account_id, sender } = msg.dissolve();

    let notes = client.get_consumable_notes(account_id).await?;

    let _ = sender
        .send(notes)
        .inspect_err(|_| tracing::error!("oneshot sender failed to send list of consumable notes"));

    Ok(())
}

#[tracing::instrument(skip_all)]
async fn handle_propose_multisig_tx<AUTH>(
    client: &mut MultisigClient<AUTH>,
    msg: ProposeMultisigTx,
) -> Result<()>
where
    AUTH: TransactionAuthenticator + Sync + 'static,
{
    client.sync_state().await?;

    let ProposeMultisigTxDissolved { account_id, tx_request, sender } = msg.dissolve();

    let tx_summary = client.propose_multisig_transaction(account_id, tx_request).await;

    let _ = sender
        .send(tx_summary.map_err(From::from))
        .inspect_err(|_| tracing::error!("oneshot sender failed to send tx summary"));

    Ok(())
}

#[tracing::instrument(skip_all)]
async fn handle_process_multisig_tx<AUTH>(
    client: &mut MultisigClient<AUTH>,
    msg: ProcessMultisigTx,
) -> Result<()>
where
    AUTH: TransactionAuthenticator + Sync + 'static,
{
    client.sync_state().await?;

    let ProcessMultisigTxDissolved {
        account_id,
        tx_request,
        tx_summary,
        signatures,
        sender,
    } = msg.dissolve();

    let account_record = client.try_get_account(account_id).await?;

    let signatures = signatures
        .into_iter()
        .map(|s| s.map(miden_multisig_coordinator_utils::rpo_falcon512_signature_into_felt_vec))
        .collect();

    let tx_result = client
        .new_multisig_transaction(account_record.into(), tx_request, tx_summary, signatures)
        .await;

    if let Ok(tx_result) = &tx_result {
        client.submit_transaction(tx_result.clone()).await?;
    }

    let _ = sender
        .send(tx_result.map_err(From::from))
        .inspect_err(|_| tracing::error!("oneshot sender failed to send tx result"));

    Ok(())
}
