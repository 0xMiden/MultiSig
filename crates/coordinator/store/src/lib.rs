//! Persistence layer for the multisig coordinator.
//!
//! This crate provides database storage and retrieval operations for multisig accounts,
//! transactions, signatures, and approver information. It acts as the data access layer
//! for the coordinator, handling all interactions with the PostgreSQL database.
//!
//! # Architecture
//!
//! The store is built on top of [diesel](diesel.rs) with async PostgreSQL support, providing:
//! - Connection pooling via [deadpool](docs.rs/deadpool) for efficient resource management
//! - Transaction support for atomic operations
//! - Type-safe database queries and conversions
//!
//! # Main Components
//!
//! - [`MultisigStore`] - The primary interface for database operations
//! - [`DbPool`] - Connection pool type for managing database connections
//! - [`DbConn`] - Individual database connection from the pool
//! - [`MultisigStoreError`] - Error types for store operations
//!
//! # Usage
//!
//! ```ignore
//! // Establish a connection pool
//! let pool = establish_pool(database_url, max_connections).await?;
//!
//! // Create the store
//! let store = MultisigStore::new(pool);
//!
//! // Store operations
//! let account = store.get_multisig_account(network_id, address).await?;
//! let txs = store.get_txs_by_multisig_account_address_with_status_filter(
//!     network_id,
//!     address,
//!     Some(MultisigTxStatus::Pending)
//! ).await?;
//! ```

mod error;
mod persistence;

pub use self::{
    error::MultisigStoreError,
    persistence::pool::{DbConn, DbPool, establish_pool},
};

use core::num::NonZeroU32;

use diesel_async::AsyncConnection;
use futures::{Stream, StreamExt, TryStreamExt};
use miden_client::{
    Word,
    account::{AccountIdAddress, Address, NetworkId},
    transaction::TransactionRequest,
    utils::{Deserializable, Serializable},
};
use miden_multisig_coordinator_domain::{
    Timestamps,
    account::{MultisigAccount, MultisigApprover, WithApprovers, WithPubKeyCommits},
    tx::{MultisigTx, MultisigTxId, MultisigTxStats, MultisigTxStatus},
};
use miden_multisig_coordinator_utils::extract_network_id_account_id_address_pair;
use miden_objects::{
    crypto::dsa::rpo_falcon512::{PublicKey, Signature},
    transaction::TransactionSummary,
};
use oblux::U63;

use self::{
    error::Result,
    persistence::{
        record::{
            insert::{
                NewApproverRecord, NewMultisigAccountRecord, NewSignatureRecord, NewTxRecord,
            },
            select::{
                ApproverRecord, ApproverRecordDissolved, MultisigAccountRecord,
                MultisigAccountRecordDissolved, TxRecord, TxRecordDissolved,
            },
        },
        store::{self, StoreError},
    },
};

/// The main store interface for multisig coordinator persistence operations.
///
/// `MultisigStore` provides high-level methods for interacting with the database,
/// managing multisig accounts, transactions, signatures, and approvers.
pub struct MultisigStore {
    pool: DbPool,
}

impl MultisigStore {
    /// Creates a new `MultisigStore` instance with the given connection pool.
    pub fn new(pool: DbPool) -> Self {
        MultisigStore { pool }
    }
}

impl MultisigStore {
    /// Creates a new multisig account in the database.
    ///
    /// This method stores the account details along with all associated approvers
    /// and their public key commitments in a single database transaction.
    ///
    /// # Arguments
    ///
    /// * `multisig_account` - A fully configured multisig account with approvers and public key commitments.
    ///
    /// # Returns
    ///
    /// Returns the created account with timestamp metadata on success.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The database transaction fails
    /// - An account with the same address already exists
    /// - Any approver data is invalid
    #[tracing::instrument(
        skip_all,
        fields(
            address = %multisig_account.address().id().to_hex(),
            network_id = %multisig_account.network_id(),
            kind = %multisig_account.kind(),
            threshold = multisig_account.threshold(),
            approver_count = multisig_account.approvers().len(),
        ),
    )]
    pub async fn create_multisig_account(
        &self,
        multisig_account: MultisigAccount<WithApprovers, WithPubKeyCommits, ()>,
    ) -> Result<MultisigAccount<WithApprovers, WithPubKeyCommits>> {
        self.get_conn()
            .await?
            .transaction(|conn| {
                Box::pin(async move {
                    let multisig_account_address = Address::AccountId(multisig_account.address())
                        .to_bech32(multisig_account.network_id());

                    let new_multisig_account = NewMultisigAccountRecord::builder()
                        .address(&multisig_account_address)
                        .kind(multisig_account.kind().into())
                        .threshold(multisig_account.threshold().get().into())
                        .build();

                    let timestamps = store::save_new_multisig_account(conn, new_multisig_account)
                        .await
                        .map(|t| Timestamps::builder().created_at(t).updated_at(t).build())?;

                    for (idx, (&approver_account_id_address, &pub_key_commit)) in multisig_account
                        .approvers()
                        .iter()
                        .zip(multisig_account.pub_key_commits())
                        .enumerate()
                    {
                        let approver_address = Address::AccountId(approver_account_id_address)
                            .to_bech32(multisig_account.network_id());

                        let pub_key_commit_bz = Word::from(pub_key_commit).as_bytes();

                        let new_approver = NewApproverRecord::builder()
                            .address(&approver_address)
                            .pub_key_commit(&pub_key_commit_bz)
                            .build();

                        store::upsert_approver(conn, new_approver).await?;

                        // casting idx to u32 is safe as approvers length cannot exceed u32::MAX
                        store::save_new_multisig_account_approver_mapping(
                            conn,
                            &multisig_account_address,
                            &approver_address,
                            idx as u32,
                        )
                        .await?;
                    }

                    Ok(multisig_account.with_aux(timestamps).0)
                })
            })
            .await
            .map_err(MultisigStoreError::Store)
    }

    /// Creates a new multisig transaction proposal.
    ///
    /// This method stores a transaction proposal that requires multiple signatures
    /// before it can be executed. The transaction is initially created with a "pending" status.
    ///
    /// # Returns
    ///
    /// Returns the unique transaction ID on success.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The multisig account doesn't exist
    /// - Serialization of transaction data fails
    /// - The database operation fails
    #[tracing::instrument(
        skip_all,
        fields(%network_id, account_id_address = account_id_address.id().to_hex()),
    )]
    pub async fn create_multisig_tx(
        &self,
        network_id: NetworkId,
        account_id_address: AccountIdAddress,
        tx_request: &TransactionRequest,
        tx_summary: &TransactionSummary,
    ) -> Result<MultisigTxId> {
        let multisig_account_address = Address::AccountId(account_id_address).to_bech32(network_id);

        let tx_request_bz = tx_request.to_bytes();
        let tx_summary_bz = tx_summary.to_bytes();
        let tx_summary_commit_bz = tx_summary.to_commitment().as_bytes();

        let new_tx = NewTxRecord::builder()
            .multisig_account_address(&multisig_account_address)
            .tx_request(&tx_request_bz)
            .tx_summary(&tx_summary_bz)
            .tx_summary_commit(&tx_summary_commit_bz)
            .build();

        store::save_new_tx(&mut self.get_conn().await?, new_tx)
            .await
            .map(From::from)
            .map_err(From::from)
    }

    /// Adds a signature from an approver to a multisig transaction.
    ///
    /// This method validates that the approver is authorized to sign the transaction,
    /// stores the signature, and checks if the signature threshold has been met.
    ///
    /// # Returns
    ///
    /// - `Ok(Some(true))` if the signature was added and the threshold is now met
    /// - `Ok(Some(false))` if the signature was added but more signatures are needed
    /// - `Ok(None)` if the approver is not authorized to sign this transaction
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The transaction doesn't exist
    /// - The database transaction fails
    /// - Signature serialization fails
    #[tracing::instrument(
        skip_all,
        fields(
            %tx_id,
            %network_id,
            approver_account_id_address = %approver_account_id_address.id().to_hex(),
        ),
    )]
    pub async fn add_multisig_tx_signature(
        &self,
        tx_id: &MultisigTxId,
        network_id: NetworkId,
        approver_account_id_address: AccountIdAddress,
        signature: &Signature,
    ) -> Result<Option<bool>> {
        self.get_conn()
            .await?
            .transaction(|conn| {
                Box::pin(async move {
                    let approver_address =
                        Address::AccountId(approver_account_id_address).to_bech32(network_id);

                    if !store::validate_approver_address_by_tx_id(
                        conn,
                        tx_id.into(),
                        &approver_address,
                    )
                    .await?
                    {
                        return Ok(None);
                    }

                    let signature_bz = signature.to_bytes();

                    let new_signature = NewSignatureRecord::builder()
                        .tx_id(tx_id.into())
                        .approver_address(&approver_address)
                        .signature_bytes(&signature_bz)
                        .build();

                    store::save_new_signature(conn, new_signature).await?;

                    let (tx_record, signature_count) =
                        store::fetch_tx_with_signature_count_by_id(conn, tx_id.into())
                            .await?
                            .ok_or(StoreError::other("tx not found"))?;

                    let TxRecordDissolved { multisig_account_address, .. } = tx_record.dissolve();

                    let MultisigAccountRecordDissolved { threshold, .. } =
                        store::fetch_mutisig_account_by_address(conn, &multisig_account_address)
                            .await?
                            .map(MultisigAccountRecord::dissolve)
                            .ok_or(StoreError::other("multisig account not found"))?;

                    Ok(Some(signature_count.to_signed() >= threshold))
                })
            })
            .await
            .map_err(MultisigStoreError::Store)
    }

    /// Updates the execution status of a multisig transaction.
    ///
    /// This method changes the transaction status (e.g., from pending to success or failure)
    /// after the transaction has been processed.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The transaction ID doesn't exist
    /// - The database update fails
    #[tracing::instrument(skip_all, fields(%tx_id, %new_status))]
    pub async fn update_multisig_tx_status_by_id(
        &self,
        tx_id: &MultisigTxId,
        new_status: MultisigTxStatus,
    ) -> Result<()> {
        let conn = &mut self.get_conn().await?;

        if !store::update_status_by_tx_id(conn, tx_id.into(), new_status.into()).await? {
            return Err(MultisigStoreError::NotFound("tx id not found".into()));
        }

        Ok(())
    }

    /// Retrieves a multisig account by its address.
    ///
    /// This method fetches the basic account information (address, network, kind, threshold)
    /// but does not include the approvers or public key commitments.
    ///
    /// # Returns
    ///
    /// Returns `Some(account)` if found, or `None` if the account doesn't exist.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The database query fails
    /// - Stored data cannot be deserialized
    #[tracing::instrument(
        skip_all,
        fields(
            %network_id,
            account_id_address = %account_id_address.id().to_hex(),
        )
    )]
    pub async fn get_multisig_account(
        &self,
        network_id: NetworkId,
        account_id_address: AccountIdAddress,
    ) -> Result<Option<MultisigAccount>> {
        let conn = &mut self.get_conn().await?;

        let address = Address::AccountId(account_id_address).to_bech32(network_id);

        let Some(MultisigAccountRecordDissolved { kind, threshold, created_at, .. }) =
            store::fetch_mutisig_account_by_address(conn, &address)
                .await?
                .map(MultisigAccountRecord::dissolve)
        else {
            return Ok(None);
        };

        let threshold = threshold
            .try_into()
            .map(NonZeroU32::new)
            .map_err(|_| MultisigStoreError::InvalidValue)?
            .ok_or(MultisigStoreError::InvalidValue)?;

        let timestamps =
            Timestamps::builder().created_at(created_at).updated_at(created_at).build();

        let multisig_account = MultisigAccount::builder()
            .address(account_id_address)
            .network_id(network_id)
            .kind(kind.into_inner())
            .threshold(threshold)
            .aux(timestamps)
            .build();

        Ok(Some(multisig_account))
    }

    #[tracing::instrument(skip_all)]
    pub async fn get_all_multisig_accounts(&self) -> Result<Vec<MultisigAccount>> {
        store::stream_multisig_accounts(&mut self.get_conn().await?)
            .await?
            .map_ok(make_multisig_account)
            .map_err(From::from)
            .map(Result::flatten)
            .try_collect()
            .await
    }

    #[tracing::instrument(skip_all)]
    pub async fn get_approvers_by_multisig_account_address(
        &self,
        network_id: NetworkId,
        multisig_account_id_address: AccountIdAddress,
    ) -> Result<Vec<MultisigApprover>> {
        let conn = &mut self.get_conn().await?;

        let multisig_account_address =
            Address::AccountId(multisig_account_id_address).to_bech32(network_id);

        store::stream_approvers_by_multisig_account_address(conn, &multisig_account_address)
            .await?
            .map_ok(make_multisig_approver)
            .map_err(From::from)
            .map(Result::flatten)
            .try_collect()
            .await
    }

    /// Retrieves all transactions for a multisig account, optionally filtered by status.
    ///
    /// Fetches transactions associated with a specific account address,
    /// with optional filtering by execution status (pending, success, failure).
    ///
    /// # Returns
    ///
    /// Returns a list of transactions matching the criteria.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The database query fails
    /// - Transaction data cannot be deserialized
    #[tracing::instrument(
        skip_all,
        fields(
            %network_id,
            address = %address.id().to_hex(),
        ),
    )]
    pub async fn get_txs_by_multisig_account_address_with_status_filter<TSF>(
        &self,
        network_id: NetworkId,
        address: AccountIdAddress,
        tx_status_filter: TSF, // TODO: add support to filter on multiple `tx_status_filter`
    ) -> Result<Vec<MultisigTx>>
    where
        Option<MultisigTxStatus>: From<TSF>,
    {
        let conn = &mut self.get_conn().await?;

        let address = Address::AccountId(address).to_bech32(network_id);

        fn transform_into_multisig_tx(
            stream: impl Stream<Item = Result<(TxRecord, U63), StoreError>>,
        ) -> impl Stream<Item = Result<MultisigTx, MultisigStoreError>> {
            stream
                .map_err(MultisigStoreError::from)
                .map_ok(|(tx_record, sigs_count)| make_multisig_tx(tx_record, sigs_count))
                .map(Result::flatten)
        }

        match tx_status_filter.into() {
            Some(status) => {
                store::stream_txs_with_signature_count_by_multisig_account_address_and_status(
                    conn,
                    &address,
                    status.into(),
                )
                .await
                .map(transform_into_multisig_tx)?
                .try_collect()
                .await
            },
            None => {
                store::stream_txs_with_signature_count_by_multisig_account_address(conn, &address)
                    .await
                    .map(transform_into_multisig_tx)?
                    .try_collect()
                    .await
            },
        }
    }

    /// Retrieves a specific multisig transaction by its ID.
    ///
    /// # Returns
    ///
    /// Returns `Some(transaction)` if found, or `None` if the transaction doesn't exist.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The database query fails
    /// - Transaction data cannot be deserialized
    #[tracing::instrument(skip_all, fields(%id))]
    pub async fn get_multisig_tx_by_id(&self, id: &MultisigTxId) -> Result<Option<MultisigTx>> {
        store::fetch_tx_with_signature_count_by_id(&mut self.get_conn().await?, id.into())
            .await?
            .map(|(tx_record, sigs_count)| make_multisig_tx(tx_record, sigs_count))
            .transpose()
    }

    #[tracing::instrument(skip(self))]
    pub async fn get_multisig_tx_stats_by_multisig_account_address(
        &self,
        network_id: NetworkId,
        multisig_account_id_address: AccountIdAddress,
    ) -> Result<MultisigTxStats> {
        let conn = &mut self.get_conn().await?;
        let address = Address::AccountId(multisig_account_id_address).to_bech32(network_id);

        store::fetch_tx_stats_by_multisig_account_address(conn, &address)
            .await
            .map_err(From::from)
    }

    /// Retrieves an approver by their account address.
    ///
    /// This method looks up an approver's information including their public key commitment.
    ///
    /// # Returns
    ///
    /// Returns `Some(approver)` if found, or `None` if the approver doesn't exist.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The database query fails
    /// - Approver data cannot be deserialized
    #[tracing::instrument(
        skip_all,
        fields(
            %network_id,
            approver_account_id_address = %approver_account_id_address.id().to_hex(),
        )
    )]
    pub async fn get_approver_by_approver_address(
        &self,
        network_id: NetworkId,
        approver_account_id_address: AccountIdAddress,
    ) -> Result<Option<MultisigApprover>> {
        let address = Address::AccountId(approver_account_id_address).to_bech32(network_id);
        store::fetch_approver_by_approver_address(&mut self.get_conn().await?, &address)
            .await?
            .map(make_multisig_approver)
            .transpose()
    }

    /// Retrieves all signatures for a transaction along with the transaction details.
    ///
    /// This method fetches signatures from all approvers for a specific transaction,
    /// ordered by the approver index. Approvers who haven't signed yet will have `None`
    /// in their respective position(s).
    ///
    /// # Returns
    ///
    /// Returns a tuple of:
    /// - A list of optional signatures (one per approver, in order)
    /// - The transaction details
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The transaction doesn't exist
    /// - Signature data cannot be deserialized
    /// - The database query fails
    #[tracing::instrument(skip_all, fields(%tx_id))]
    pub async fn get_signatures_of_all_approvers_with_multisig_tx_by_tx_id(
        &self,
        tx_id: &MultisigTxId,
    ) -> Result<(Vec<Option<Signature>>, MultisigTx)> {
        let (signatures, tx_record) =
            store::fetch_all_signature_bytes_with_tx_by_tx_id_in_order_of_approvers(
                &mut self.get_conn().await?,
                tx_id.into(),
            )
            .await?;

        let mut sigs_count = 0i64;

        let signatures = signatures
            .into_iter()
            .inspect(|s| {
                if s.is_some() {
                    sigs_count += 1
                }
            })
            .map(|s| s.as_deref().map(Deserializable::read_from_bytes).transpose())
            .map(|s| s.map_err(|_| MultisigStoreError::InvalidValue))
            .collect::<Result<_, _>>()?;

        // unwrap is safe because sigs_count is non-negative
        let sigs_count = U63::from_signed(sigs_count).unwrap();

        Ok((signatures, make_multisig_tx(tx_record, sigs_count)?))
    }

    async fn get_conn(&self) -> Result<DbConn> {
        self.pool.get().await.map_err(|_| MultisigStoreError::Pool)
    }
}

fn make_multisig_account(
    multisig_account_record: MultisigAccountRecord,
) -> Result<MultisigAccount> {
    let MultisigAccountRecordDissolved { address, kind, threshold, created_at } =
        multisig_account_record.dissolve();

    let (network_id, account_id_address) = extract_network_id_account_id_address_pair(&address)
        .map_err(|e| MultisigStoreError::Other(e.to_string().into()))?;

    let threshold = threshold
        .try_into()
        .map(NonZeroU32::new)
        .map_err(|_| MultisigStoreError::InvalidValue)?
        .ok_or(MultisigStoreError::InvalidValue)?;

    let timestamps = Timestamps::builder().created_at(created_at).updated_at(created_at).build();

    let multisig_account = MultisigAccount::builder()
        .address(account_id_address)
        .network_id(network_id)
        .kind(kind.into_inner())
        .threshold(threshold)
        .aux(timestamps)
        .build();

    Ok(multisig_account)
}

fn make_multisig_tx(tx_record: TxRecord, signature_count: U63) -> Result<MultisigTx> {
    let TxRecordDissolved {
        id,
        multisig_account_address,
        status,
        tx_request,
        tx_summary,
        tx_summary_commit,
        created_at,
    } = tx_record.dissolve();

    let (network_id, address) =
        miden_multisig_coordinator_utils::extract_network_id_account_id_address_pair(
            &multisig_account_address,
        )
        .map_err(|e| MultisigStoreError::Other(e.to_string().into()))?;

    let tx_request = TransactionRequest::read_from_bytes(&tx_request)
        .map_err(|_| MultisigStoreError::InvalidValue)?;

    let tx_summary = TransactionSummary::read_from_bytes(&tx_summary)
        .map_err(|_| MultisigStoreError::InvalidValue)?;

    let tx_summary_commit =
        Word::read_from_bytes(&tx_summary_commit).map_err(|_| MultisigStoreError::InvalidValue)?;

    let timestamps = Timestamps::builder().created_at(created_at).updated_at(created_at).build();

    let signature_count = signature_count
        .get()
        .try_into()
        .map(NonZeroU32::new)
        .map_err(|_| MultisigStoreError::InvalidValue)?;

    let tx = MultisigTx::builder()
        .id(id.into())
        .address(address)
        .network_id(network_id)
        .status(status.into_inner())
        .tx_request(tx_request)
        .tx_summary(tx_summary)
        .tx_summary_commit(tx_summary_commit)
        .maybe_signature_count(signature_count)
        .aux(timestamps)
        .build();

    Ok(tx)
}

fn make_multisig_approver(approver_record: ApproverRecord) -> Result<MultisigApprover> {
    let ApproverRecordDissolved { address, pub_key_commit, created_at } =
        approver_record.dissolve();

    let (network_id, address) =
        miden_multisig_coordinator_utils::extract_network_id_account_id_address_pair(&address)
            .map_err(|e| MultisigStoreError::Other(e.to_string().into()))?;

    let pub_key_commit = Word::read_from_bytes(&pub_key_commit)
        .map(PublicKey::new)
        .map_err(|_| MultisigStoreError::InvalidValue)?;

    let timestamps = Timestamps::builder().created_at(created_at).updated_at(created_at).build();

    let approver = MultisigApprover::builder()
        .address(address)
        .network_id(network_id)
        .pub_key_commit(pub_key_commit)
        .aux(timestamps)
        .build();

    Ok(approver)
}
