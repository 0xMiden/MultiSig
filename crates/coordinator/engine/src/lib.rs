#![allow(missing_docs)]

mod error;
mod multisig_client_runtime;
mod types;

pub use self::{
    error::MultisigEngineError,
    multisig_client_runtime::MultisigClientRuntimeConfig,
    types::{request, response},
};

use std::thread::JoinHandle;

use miden_client::{
    account::{AccountIdAddress, AccountStorageMode, AddressInterface, NetworkId},
    note::NoteConsumability,
    store::InputNoteRecord,
    transaction::TransactionResult,
};
use miden_multisig_coordinator_domain::{
    account::MultisigAccount,
    tx::{MultisigTxDissolved, MultisigTxStatus},
};
use miden_multisig_coordinator_store::MultisigStore;
use tokio::{
    runtime::Runtime,
    sync::{
        mpsc::{self, error::SendError},
        oneshot,
    },
};

use self::{
    error::MultisigEngineErrorKind,
    multisig_client_runtime::{
        MultisigClientRuntimeError,
        msg::{
            CreateMultisigAccount, GetConsumableNotes, MidenMsg, ProcessMultisigTx,
            ProposeMultisigTx,
        },
    },
    types::{
        request::{
            AddSignatureRequest, AddSignatureRequestDissolved, CreateMultisigAccountRequest,
            CreateMultisigAccountRequestDissolved, GetConsumableNotesRequest,
            GetConsumableNotesRequestDissolved, GetMultisigAccountRequest,
            GetMultisigAccountRequestDissolved, ListMultisigTxRequest,
            ListMultisigTxRequestDissolved, ProposeMultisigTxRequest,
            ProposeMultisigTxRequestDissolved,
        },
        response::{
            CreateMultisigAccountResponse, GetMultisigAccountResponse, ListMultisigTxResponse,
            ProposeMultisigTxResponse,
        },
    },
};

pub struct MultisigEngine<R> {
    network_id: NetworkId,
    store: MultisigStore,
    runtime: R,
}

pub struct Stopped;

pub struct Started {
    sender: mpsc::UnboundedSender<MidenMsg>,
    handle: JoinHandle<Result<(), MultisigClientRuntimeError>>,
}

impl<R> MultisigEngine<R> {
    pub fn network_id(&self) -> NetworkId {
        self.network_id
    }
}

impl MultisigEngine<Stopped> {
    pub fn new(network_id: NetworkId, store: MultisigStore) -> Self {
        Self { network_id, store, runtime: Stopped }
    }

    pub fn start_multisig_client_runtime(
        self,
        rt: Runtime,
        multisig_client_runtime_config: MultisigClientRuntimeConfig,
    ) -> MultisigEngine<Started> {
        let (sender, receiver) = mpsc::unbounded_channel();

        let handle =
            multisig_client_runtime::spawn_new(rt, receiver, multisig_client_runtime_config);

        MultisigEngine {
            network_id: self.network_id(),
            store: self.store,
            runtime: Started { sender, handle },
        }
    }
}

impl MultisigEngine<Started> {
    pub async fn create_multisig_account(
        &self,
        request: CreateMultisigAccountRequest,
    ) -> Result<CreateMultisigAccountResponse, MultisigEngineError> {
        let CreateMultisigAccountRequestDissolved { threshold, approvers, pub_key_commits } =
            request.dissolve();

        let (msg, receiver) = {
            let (sender, receiver) = oneshot::channel();

            let msg = CreateMultisigAccount::builder()
                .threshold(threshold)
                .approvers(pub_key_commits.clone())
                .sender(sender)
                .build();

            (MidenMsg::CreateMultisigAccount(msg), receiver)
        };

        self.send_to_multisig_client_runtime(msg).map_err(|_| {
            MultisigEngineErrorKind::mpsc_sender("failed to send create multisig account")
        })?;

        let miden_account = receiver.await.map_err(MultisigEngineErrorKind::from)?;

        let multisig_account = MultisigAccount::builder()
            .address(AccountIdAddress::new(miden_account.id(), AddressInterface::BasicWallet))
            .network_id(self.network_id())
            .kind(AccountStorageMode::Public) // TODO: add support for private multisig accounts
            .threshold(threshold)
            .aux(())
            .build()
            .with_approvers(approvers)
            .ok_or(MultisigEngineErrorKind::other("threshold exceeds approvers length"))?
            .with_pub_key_commits(pub_key_commits)
            .ok_or(MultisigEngineErrorKind::other("approvers length mismatches pub key commits"))
            .map(|multisig_account| self.store.create_multisig_account(multisig_account))?
            .await
            .map(From::from)
            .map_err(MultisigEngineErrorKind::from)?;

        let response = CreateMultisigAccountResponse::builder()
            .miden_account(miden_account)
            .multisig_account(multisig_account)
            .build();

        Ok(response)
    }

    pub async fn get_consumable_notes(
        &self,
        request: GetConsumableNotesRequest,
    ) -> Result<Vec<(InputNoteRecord, Vec<NoteConsumability>)>, MultisigEngineError> {
        let GetConsumableNotesRequestDissolved { address } = request.dissolve();

        let (msg, receiver) = {
            let (sender, receiver) = oneshot::channel();

            let msg = GetConsumableNotes::builder()
                .maybe_account_id(address.as_ref().map(AccountIdAddress::id))
                .sender(sender)
                .build();

            (MidenMsg::GetConsumableNotes(msg), receiver)
        };

        self.send_to_multisig_client_runtime(msg).map_err(|_| {
            MultisigEngineErrorKind::mpsc_sender("failed to send get consmable notes")
        })?;

        receiver.await.map_err(MultisigEngineErrorKind::from).map_err(From::from)
    }

    pub async fn propose_multisig_tx(
        &self,
        request: ProposeMultisigTxRequest,
    ) -> Result<ProposeMultisigTxResponse, MultisigEngineError> {
        let ProposeMultisigTxRequestDissolved { address, tx_request } = request.dissolve();

        let (msg, receiver) = {
            let (sender, receiver) = oneshot::channel();

            let msg = ProposeMultisigTx::builder()
                .account_id(address.id())
                .tx_request(tx_request.clone())
                .sender(sender)
                .build();

            (MidenMsg::ProposeMultisigTx(msg), receiver)
        };

        self.send_to_multisig_client_runtime(msg).map_err(|_| {
            MultisigEngineErrorKind::mpsc_sender("failed to send propose multisig tx")
        })?;

        self.store
            .get_multisig_account(self.network_id(), address)
            .await
            .map_err(MultisigEngineErrorKind::from)?
            .ok_or(MultisigEngineErrorKind::not_found("account not found"))?;

        let tx_summary = receiver
            .await
            .map_err(MultisigEngineErrorKind::from)?
            .map_err(MultisigEngineErrorKind::from)?;

        let tx_id = self
            .store
            .create_multisig_tx(self.network_id(), address, &tx_request, &tx_summary)
            .await
            .map_err(MultisigEngineErrorKind::from)?;

        let response =
            ProposeMultisigTxResponse::builder().tx_id(tx_id).tx_summary(tx_summary).build();

        Ok(response)
    }

    pub async fn add_signature(
        &self,
        request: AddSignatureRequest,
    ) -> Result<Option<TransactionResult>, MultisigEngineError> {
        let AddSignatureRequestDissolved { tx_id, approver, signature } = request.dissolve();

        let threshold_met = self
            .store
            .add_multisig_tx_signature(&tx_id, self.network_id(), approver, &signature)
            .await
            .map_err(MultisigEngineErrorKind::from)?
            .ok_or(MultisigEngineErrorKind::other(
                "approver not permitted to add signature for tx",
            ))?;

        // TODO: make transaction processing async
        if threshold_met {
            let (signatures, multisig_tx) = self
                .store
                .get_signatures_of_all_approvers_with_multisig_tx_by_tx_id(&tx_id)
                .await
                .map_err(MultisigEngineErrorKind::from)?;

            let (msg, receiver) = {
                let (sender, receiver) = oneshot::channel();

                let MultisigTxDissolved { address, tx_request, tx_summary, .. } =
                    multisig_tx.dissolve();

                let msg = ProcessMultisigTx::builder()
                    .account_id(address.id())
                    .tx_request(tx_request)
                    .tx_summary(tx_summary)
                    .signatures(signatures)
                    .sender(sender)
                    .build();

                (MidenMsg::ProcessMultisigTx(msg), receiver)
            };

            self.send_to_multisig_client_runtime(msg).map_err(|_| {
                MultisigEngineErrorKind::mpsc_sender("failed to send process multisig tx")
            })?;

            match receiver.await.map_err(MultisigEngineErrorKind::from)? {
                Ok(tx_result) => {
                    self.store
                        .update_multisig_tx_status_by_id(&tx_id, MultisigTxStatus::Success)
                        .await
                        .map_err(MultisigEngineErrorKind::from)?;

                    return Ok(Some(tx_result));
                },
                Err(e) => {
                    // TODO: ascertain the scenarios this can occur
                    self.store
                        .update_multisig_tx_status_by_id(&tx_id, MultisigTxStatus::Failure)
                        .await
                        .map_err(MultisigEngineErrorKind::from)?;

                    return Err(MultisigEngineErrorKind::from(e).into());
                },
            }
        }

        Ok(None)
    }

    pub async fn get_multisig_account(
        &self,
        request: GetMultisigAccountRequest,
    ) -> Result<GetMultisigAccountResponse, MultisigEngineError> {
        let GetMultisigAccountRequestDissolved { multisig_account_id_address } = request.dissolve();

        let multisig_account = self
            .store
            .get_multisig_account(self.network_id(), multisig_account_id_address)
            .await
            .map_err(MultisigEngineErrorKind::from)?;

        let response = GetMultisigAccountResponse::builder()
            .maybe_multisig_account(multisig_account)
            .build();

        Ok(response)
    }

    // TODO: add pagination support
    pub async fn list_multisig_tx(
        &self,
        request: ListMultisigTxRequest,
    ) -> Result<ListMultisigTxResponse, MultisigEngineError> {
        let ListMultisigTxRequestDissolved {
            multisig_account_id_address,
            tx_status_filter,
        } = request.dissolve();

        self.store
            .get_txs_by_multisig_account_address_with_status_filter(
                self.network_id(),
                multisig_account_id_address,
                tx_status_filter,
            )
            .await
            .map(|txs| ListMultisigTxResponse::builder().txs(txs).build())
            .map_err(MultisigEngineErrorKind::from)
            .map_err(From::from)
    }

    pub async fn stop_multisig_client_runtime(
        self,
    ) -> Result<MultisigEngine<Stopped>, MultisigEngineError> {
        self.send_to_multisig_client_runtime(MidenMsg::Shutdown)
            .map_err(|_| MultisigEngineErrorKind::mpsc_sender("failed to send shutdown msg"))?;

        self.runtime
            .handle
            .join()
            .map_err(|_| {
                MultisigEngineErrorKind::other("multisig client runtime thread misbehavior")
            })?
            .map_err(MultisigEngineErrorKind::from)?;

        let engine = MultisigEngine {
            network_id: self.network_id,
            store: self.store,
            runtime: Stopped,
        };

        Ok(engine)
    }

    #[allow(clippy::result_large_err)]
    fn send_to_multisig_client_runtime(&self, msg: MidenMsg) -> Result<(), SendError<MidenMsg>> {
        self.runtime.sender.send(msg)
    }
}
