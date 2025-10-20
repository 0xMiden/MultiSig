//! # Multisig Coordinator Engine
//!
//! This crate provides the core orchestration layer for managing Miden multisig accounts and
//! transactions in a concurrent web server environment.
//!
//! ## Architecture Overview
//!
//! The [`MultisigEngine`] orchestrates between two key components:
//!
//! 1. `MultisigClientRuntime`: Manages the Miden blockchain client
//!    in a dedicated thread (see [`MultisigClientRuntimeConfig`])
//! 2. **[`MultisigStore`]**: Provides persistent storage for multisig account and transaction data
//!
//! ```text
//! ┌─────────────────────────────────────────────────────┐
//! │                  Web Server (Axum)                  │
//! │            Arc<MultisigEngine<Started>>             │
//! │                    (Send + Sync)                    │
//! └──────────────────────────┬──────────────────────────┘
//!                            │
//!            ┌───────────────┴───────────────┐
//!            │                               │
//!            ▼                               ▼
//! ┌──────────────────────┐       ┌─────────────────────┐
//! │ MultisigStore        │       │ MultisigClient      │
//! │ (PostgreSQL)         │       │ Runtime Thread      │
//! │                      │       │                     │
//! │  - Accounts          │       │ - dedicated thread  │
//! │  - Approvers         │       │ - LocalSet          │              
//! │  - Transactions      │       │ - !Send + !Sync     │
//! │  - Signatures        │       │ - mpsc channels     │
//! └──────────────────────┘       └─────────────────────┘
//! ```
//!
//! ## Why a Separate Thread?
//!
//! The Miden [`MultisigClient`] is **neither `Send` nor `Sync`** and this creates
//! a fundamental incompatibility with async runtimes:
//!
//! ### Problem 1: Cannot use in tokio directly
//! ```rust,ignore
//! // This won't compile
//! async fn handler(client: MultisigClient) {
//!     // tokio may move this future across threads
//!     // but MultisigClient is !Send
//! }
//! ```
//!
//! ### Problem 2: `Arc<MultisigClient>` doesn't help
//! ```rust,ignore
//! // This won't compile either
//! let client = Arc::new(multisig_client);
//! // Arc<T> is only Send if T: Send + Sync
//! // Since MultisigClient is !Sync, Arc<MultisigClient> is !Send
//! ```
//!
//! ### Solution: Dedicated Thread + Message Passing
//!
//! The `MultisigClientRuntime` runs the `!Send + !Sync` client in a
//! dedicated thread using tokio's [`LocalSet`], which allows running `!Send` futures on a single
//! thread. Communication happens via:
//!
//! - **Command channel**: `mpsc::UnboundedSender<MidenMsg>` (to send requests)
//! - **Response channels**: `oneshot::Sender<T>` (to receive responses)
//!
//! ### Result: `MultisigEngine` becomes `Sync`
//!
//! The [`MultisigEngine<Started>`] type contains:
//! - `mpsc::UnboundedSender` - which **is** `Sync`
//! - `MultisigStore` - which **is** `Sync` (uses async PostgreSQL)
//! - `JoinHandle` - which **is** `Sync`
//!
//! Therefore `MultisigEngine<Started>` **is `Send + Sync`**, and `Arc<MultisigEngine<Started>>`
//! is both **`Send + Sync`** and **`Clone`**, making it usable in web frameworks like
//! [axum](https://docs.rs/axum).
//!
//! ## State Machine
//!
//! The [`MultisigEngine`] uses a type-state pattern for lifecycle management:
//!
//! ```text
//! MultisigEngine<Stopped>
//!    │
//!    │ .start_multisig_client_runtime(..)
//!    │
//!    ▼
//! MultisigEngine<Started>
//!    │
//!    │ - create_multisig_account()
//!    │ - propose_multisig_tx()
//!    │ - add_signature()
//!    │ - get_multisig_account()
//!    │ - list_multisig_tx()
//!    │ - get_consumable_notes()
//!    │
//!    │ .stop_multisig_client_runtime()
//!    │
//!    ▼
//! MultisigEngine<Stopped>
//! ```
//!
//! ## Operations
//!
//! The engine provides the following operations (available in [`MultisigEngine<Started>`] state):
//!
//! - **Account Management**:
//!   - [`create_multisig_account`](MultisigEngine::create_multisig_account) - Create a new
//!     multisig account
//!   - [`get_multisig_account`](MultisigEngine::get_multisig_account) - Retrieve account details
//!
//! - **Transaction Management**:
//!   - [`propose_multisig_tx`](MultisigEngine::propose_multisig_tx) - Propose a new transaction
//!   - [`add_signature`](MultisigEngine::add_signature) - Add an approver's signature
//!   - [`list_multisig_tx`](MultisigEngine::list_multisig_tx) - List transactions for an account
//!
//! - **Notes**:
//!   - [`get_consumable_notes`](MultisigEngine::get_consumable_notes) - Get consumable notes
//!
//! [`MultisigClient`]: miden_multisig_client::MultisigClient
//! [`MultisigStore`]: miden_multisig_coordinator_store::MultisigStore
//! [`LocalSet`]: tokio::task::LocalSet

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

/// The main orchestration engine for managing multisig accounts and transactions.
///
/// This type uses a type-state pattern with runtime state `R` to ensure correct lifecycle
/// management. The engine can be in one of two states:
/// - [`Stopped`]: Runtime thread is not running, only construction operations available
/// - [`Started`]: Runtime thread is running, all operations available
///
/// # Generic Parameters
///
/// * `R` - The multisig client runtime state, either [`Stopped`] or [`Started`]
pub struct MultisigEngine<R> {
    network_id: NetworkId,
    store: MultisigStore,
    runtime: R,
}

/// Marker type indicating the [`MultisigEngine`] is in the stopped state.
///
/// In this state, no blockchain operations can be performed.
pub struct Stopped;

/// Marker type indicating the [`MultisigEngine`] is in the started state.
///
/// In this state:
/// - The multisig client runtime thread is running
/// - All blockchain operations are available
/// - Communication happens via message passing channels
pub struct Started {
    sender: mpsc::UnboundedSender<MidenMsg>,
    handle: JoinHandle<Result<(), MultisigClientRuntimeError>>,
}

impl<R> MultisigEngine<R> {
    /// Returns the network ID this engine is configured for.
    pub fn network_id(&self) -> NetworkId {
        self.network_id
    }
}

impl MultisigEngine<Stopped> {
    /// Creates a new [`MultisigEngine<Stopped>`].
    pub fn new(network_id: NetworkId, store: MultisigStore) -> Self {
        Self { network_id, store, runtime: Stopped }
    }

    /// Starts the multisig client runtime thread and transitions to the [`Started`] state.
    ///
    /// This spawns a dedicated thread that runs the [`MultisigClient`](miden_multisig_client::MultisigClient).
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
    /// Creates a new multisig account on the blockchain and persists it in the database.
    ///
    /// This operation:
    /// 1. Sends a request to the runtime thread to create the account on-chain
    /// 2. Stores the account metadata in the persistent store
    /// 3. Returns the blockchain account and the coordinator's view of the persisted multisig account
    ///
    /// # Errors
    ///
    /// This function will return an error if:
    /// - Communication with the runtime thread fails
    /// - The blockchain account creation fails
    /// - Database storage fails
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

    /// Retrieves consumable notes for a multisig account.
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

    /// Proposes a new multisig transaction.
    ///
    /// This is the first step in the multisig transaction flow. The transaction is validated
    /// and a transaction summary is generated, but the transaction is not yet executed.
    /// Approvers must add their signatures before the transaction can be processed.
    ///
    /// # Transaction Flow
    ///
    /// ```text
    /// 1. propose_multisig_tx() ──> Creates transaction with status: Pending
    ///                              Stores in database
    /// 2. add_signature()       ──> Approvers add signatures
    /// 3. add_signature()       ──> When threshold met, auto-processes
    ///                              Status: Success or Failure
    /// ```
    ///
    /// # Returns
    ///
    /// Returns the transaction ID in the database and the transaction summary.
    ///
    /// # Errors
    ///
    /// This function will return an error if:
    /// - The multisig account doesn't exist
    /// - Communication with the runtime thread fails
    /// - Transaction validation fails
    /// - Database storage fails
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

    /// Adds an approver's signature to a pending multisig transaction.
    ///
    /// When the signature threshold is met, the transaction is automatically processed
    /// and submitted to the blockchain.
    ///
    /// # Returns
    ///
    /// * `Ok(Some(TransactionResult))` - Threshold met, transaction processed successfully
    /// * `Ok(None)` - Signature added, waiting for more signatures
    ///
    /// # Errors
    ///
    /// This function will return an error if:
    /// - The approver is not authorized for this transaction
    /// - The signature is invalid
    /// - Database operations fail
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

    /// Retrieves a multisig account by its address.
    ///
    /// Queries the persistent store for multisig account metadata, including threshold,
    /// approvers, and public key commitments.
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

    /// Lists multisig transactions for a specific account.
    ///
    /// Returns transactions associated with the given account address, optionally
    /// filtered by status (Pending, Success, Failure).
    pub async fn list_multisig_tx(
        &self,
        request: ListMultisigTxRequest, // TODO: add pagination support
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

    /// Stops the multisig client runtime thread and transitions to [`Stopped`] state.
    ///
    /// This sends a shutdown message to the runtime thread and waits for it to
    /// terminate gracefully. Once stopped, the engine can no longer perform
    /// blockchain operations.
    ///
    /// # Errors
    ///
    /// This function will return an error if:
    /// - The shutdown message cannot be sent
    /// - The runtime thread panicked or misbehaved
    /// - The thread join operation fails
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
