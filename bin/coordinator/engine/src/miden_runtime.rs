pub mod msg;

mod error;

pub use self::error::MidenRuntimeError;

use core::time::Duration;

use std::{
    path::PathBuf,
    sync::Arc,
    thread::{self, JoinHandle},
};

use bon::Builder;
use miden_client::{
    auth::TransactionAuthenticator, builder::ClientBuilder, keystore::FilesystemKeyStore,
};
use miden_multisig_client::MultisigClient;
use tokio::{runtime::Runtime, sync::mpsc, task::LocalSet};
use url::Url;

use self::{
    error::Result,
    msg::{
        CreateMultisigAccount, CreateMultisigAccountDissolved, GetConsumableNotes,
        GetConsumableNotesDissolved, MidenMsg, ProcessMultisigTx, ProcessMultisigTxDissolved,
        ProposeMultisigTx, ProposeMultisigTxDissolved,
    },
};

#[tracing::instrument(skip(msg_receiver))]
pub fn spawn_new(
    rt: Runtime,
    msg_receiver: mpsc::UnboundedReceiver<MidenMsg>,
    config: MidenRuntimeConfig,
) -> JoinHandle<Result<()>> {
    thread::spawn(move || {
        let local = LocalSet::new();
        let local_runtime = local.run_until(run_miden_runtime(msg_receiver, config));
        rt.block_on(local_runtime)
    })
}

#[derive(Debug, Builder)]
pub struct MidenRuntimeConfig {
    node_url: Url,
    store_path: PathBuf,
    keystore_path: PathBuf,
    timeout: Duration,
}

#[tracing::instrument(skip(msg_receiver))]
async fn run_miden_runtime(
    mut msg_receiver: mpsc::UnboundedReceiver<MidenMsg>,
    MidenRuntimeConfig {
        node_url,
        store_path,
        keystore_path,
        timeout,
    }: MidenRuntimeConfig,
) -> Result<()> {
    let keystore = FilesystemKeyStore::new(keystore_path)
        .map_err(|e| MidenRuntimeError::other(e.to_string()))?;

    let endpoint = node_url.as_str().trim_end_matches('/').try_into().map_err(|e| {
        MidenRuntimeError::other(format!("failed to parse node url {node_url}: {e}"))
    })?;

    let store_path = store_path.to_str().ok_or(MidenRuntimeError::other("invalid store path"))?;

    let mut client = ClientBuilder::new()
        .tonic_rpc_client(&endpoint, Some(timeout.as_millis() as u64))
        .authenticator(Arc::new(keystore))
        .sqlite_store(store_path)
        .build()
        .await
        .map(MultisigClient::new)?;

    while let Some(msg) = msg_receiver.recv().await {
        match msg {
            MidenMsg::Shutdown => {
                tracing::info!("received shutdown msg, stopping miden runtime");
                break;
            },
            MidenMsg::GetConsumableNotes(msg) => {
                client.sync_state().await?;
                handle_get_consumable_notes(&mut client, msg).await?;
            },
            MidenMsg::CreateMultisigAccount(msg) => {
                handle_create_multisig_account(&mut client, msg).await?;
                client.sync_state().await?;
            },
            MidenMsg::ProposeMultisigTx(msg) => {
                client.sync_state().await?;
                handle_propose_multisig_tx(&mut client, msg).await?;
            },
            MidenMsg::ProcessMultisigTx(msg) => {
                handle_process_multisig_tx(&mut client, msg).await?;
                client.sync_state().await?;
            },
        }
    }

    tracing::info!("sutting down miden runtime");

    Ok(())
}

#[tracing::instrument(skip(client))]
async fn handle_create_multisig_account<AUTH>(
    client: &mut MultisigClient<AUTH>,
    msg: CreateMultisigAccount,
) -> Result<()>
where
    AUTH: TransactionAuthenticator + Sync + 'static,
{
    let CreateMultisigAccountDissolved { threshold, approvers, sender } = msg.dissolve();

    let account = client.setup_account(approvers, threshold.get()).await;

    sender.send(account).map_err(|_| MidenRuntimeError::Sender)
}

#[tracing::instrument(skip(client))]
async fn handle_get_consumable_notes<AUTH>(
    client: &mut MultisigClient<AUTH>,
    msg: GetConsumableNotes,
) -> Result<()>
where
    AUTH: TransactionAuthenticator + Sync + 'static,
{
    let GetConsumableNotesDissolved { account_id, sender } = msg.dissolve();

    let notes = client.get_consumable_notes(account_id).await?;

    sender.send(notes).map_err(|_| MidenRuntimeError::Sender)
}

#[tracing::instrument(skip(client))]
async fn handle_propose_multisig_tx<AUTH>(
    client: &mut MultisigClient<AUTH>,
    msg: ProposeMultisigTx,
) -> Result<()>
where
    AUTH: TransactionAuthenticator + Sync + 'static,
{
    let ProposeMultisigTxDissolved { account_id, tx_request, sender } = msg.dissolve();

    let tx_summary = client.propose_multisig_transaction(account_id, tx_request).await;

    sender
        .send(tx_summary.map_err(From::from))
        .map_err(|_| MidenRuntimeError::Sender)
}

#[tracing::instrument(skip(client))]
async fn handle_process_multisig_tx<AUTH>(
    client: &mut MultisigClient<AUTH>,
    msg: ProcessMultisigTx,
) -> Result<()>
where
    AUTH: TransactionAuthenticator + Sync + 'static,
{
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
        .map(|s| s.map(miden_falcon_sign_test::turn_sig_into_felt_vec))
        .collect();

    let tx_result = client
        .new_multisig_transaction(account_record.into(), tx_request, tx_summary, signatures)
        .await;

    if let Ok(tx_result) = &tx_result {
        client.submit_transaction(tx_result.clone()).await?;
    }

    sender
        .send(tx_result.map_err(From::from))
        .map_err(|_| MidenRuntimeError::Sender)
}
