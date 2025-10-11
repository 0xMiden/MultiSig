//! This crate defines the interactions with the persistence layer i.e. the database.

/// Payload structs.
pub mod types;

mod errors;
mod persistence;

use crate::persistence::record::{
    TxStatus,
    select::{MultisigAccountRecordDissolved, SignatureRecordDissolved, TxRecordDissolved},
};

pub use self::{errors::MultisigStoreError, persistence::pool::establish_pool};

use core::num::NonZeroU64;

use diesel_async::AsyncConnection;
use uuid::Uuid;

use self::{
    errors::Result,
    persistence::{
        pool::{DbConn, DbPool},
        record::{
            insert::{
                NewApproverRecord, NewMultisigAccountRecord, NewSignatureRecord, NewTxRecord,
            },
            select::{MultisigAccountRecord, SignatureRecord, TxRecord},
        },
        store::{self, StoreError},
    },
    types::{ContractInfo, SignatureInfo, TransactionInfo, TransactionThresholdInfo},
};

/// Represents a connection pool with PostgreSQL database for multisig operations.
pub struct MultisigStore {
    pool: DbPool,
}

impl MultisigStore {
    /// Returns a new instance of [MultisigStore] with the specified database URL.
    pub async fn new(pool: DbPool) -> Self {
        MultisigStore { pool }
    }
}

impl MultisigStore {
    /// Get multisig account information including metadata and approvers
    pub async fn get_contract_info(&self, address: &str) -> Result<Option<ContractInfo>> {
        let conn = &mut self.get_conn().await?;

        let Some(MultisigAccountRecordDissolved { address, kind, threshold, created_at }) =
            store::fetch_mutisig_account_by_address(conn, address)
                .await?
                .map(MultisigAccountRecord::dissolve)
        else {
            return Ok(None);
        };

        let approvers = store::fetch_approvers_by_multisig_account_address(conn, &address).await?;

        let contract_info = ContractInfo::builder()
            .contract_id(address)
            .approvers(approvers)
            .threshold(threshold.try_into().map_err(|_| MultisigStoreError::InvalidValue)?)
            .kind(kind.to_string())
            .created_at(created_at)
            .build();

        Ok(Some(contract_info))
    }

    /// Get transactions for a multisig account with optional status filter
    pub async fn get_contract_transactions(
        &self,
        multisig_account_address: &str,
        status_filter: Option<&str>,
    ) -> Result<Vec<TransactionInfo>, MultisigStoreError> {
        let conn = &mut self.get_conn().await?;

        let status_filter = status_filter
            .map(|s| s.parse())
            .transpose()
            .map_err(|e| MultisigStoreError::Other(format!("invalid status: {e}").into()))?;

        let txs_with_sigs_count = match status_filter {
            Some(status) => {
                store::fetch_txs_with_signature_count_by_multisig_account_address_and_status(
                    conn,
                    multisig_account_address,
                    status,
                )
                .await?
            },
            None => {
                store::fetch_txs_with_signature_count_by_multisig_account_address(
                    conn,
                    multisig_account_address,
                )
                .await?
            },
        };

        txs_with_sigs_count
            .into_iter()
            .map(|(tx, count)| (tx.dissolve(), count))
            .map(
                |(
                    TxRecordDissolved {
                        id,
                        multisig_account_address,
                        status,
                        tx_bytes,
                        tx_summary,
                        tx_summary_commit,
                        created_at,
                    },
                    count,
                )| {
                    let tx_info = TransactionInfo::builder()
                        .tx_id(id)
                        .contract_id(multisig_account_address)
                        .status(status.to_string())
                        .tx_bz(tx_bytes.into())
                        .tx_summary(tx_summary.into())
                        .tx_summary_commitment(tx_summary_commit.into())
                        .created_at(created_at)
                        .maybe_sigs_count(
                            count
                                .try_into()
                                .map(NonZeroU64::new)
                                .map_err(|_| MultisigStoreError::InvalidValue)?,
                        )
                        .build();

                    Ok(tx_info)
                },
            )
            .collect()
    }

    /// Get full transaction details by transaction ID
    pub async fn get_transaction_by_id(&self, id: Uuid) -> Result<Option<TransactionInfo>> {
        let conn = &mut self.get_conn().await?;

        let Some(TxRecordDissolved {
            id,
            multisig_account_address,
            status,
            tx_bytes,
            tx_summary,
            tx_summary_commit,
            created_at,
        }) = store::fetch_tx_by_id(conn, id).await?.map(TxRecord::dissolve)
        else {
            return Ok(None);
        };

        let tx_info = TransactionInfo::builder()
            .tx_id(id)
            .contract_id(multisig_account_address)
            .status(status.to_string())
            .tx_bz(tx_bytes.into())
            .tx_summary(tx_summary.into())
            .tx_summary_commitment(tx_summary_commit.into())
            .created_at(created_at)
            .build();

        Ok(Some(tx_info))
    }

    /// Create a new pending transaction
    pub async fn create_transaction(
        &self,
        multisig_account_address: &str,
        tx_bytes: &[u8],
        tx_summary: &[u8],
        tx_summary_commit: &[u8],
    ) -> Result<(), MultisigStoreError> {
        let new_tx = NewTxRecord::builder()
            .multisig_account_address(multisig_account_address)
            .status(TxStatus::Pending)
            .tx_bytes(tx_bytes)
            .tx_summary(tx_summary)
            .tx_summary_commit(tx_summary_commit)
            .build();

        self.get_conn()
            .await?
            .transaction(|conn| Box::pin(store::save_new_tx(conn, new_tx)))
            .await?;

        Ok(())
    }

    /// Add a signature to a transaction (with validation)
    /// Returns (signature_added, threshold_met)
    pub async fn add_transaction_signature(
        &self,
        tx_id: Uuid,
        approver_address: &str,
        signature_bytes: &[u8],
    ) -> Result<(bool, bool), MultisigStoreError> {
        self.get_conn()
            .await?
            .transaction(|conn| {
                Box::pin(async move {
                    let added = if !store::validate_approver_address_by_tx_id(
                        conn,
                        tx_id,
                        approver_address,
                    )
                    .await?
                    {
                        false
                    } else {
                        let new_tx_sig = NewSignatureRecord::builder()
                            .tx_id(tx_id)
                            .approver_address(approver_address)
                            .signature_bytes(signature_bytes)
                            .build();

                        store::save_new_signature(conn, new_tx_sig).await?;

                        true
                    };

                    // Check if threshold is met after adding signature
                    let threshold_met = if added {
                        Self::check_threshold_met_internal(conn, tx_id).await.map_err(|e| {
                            StoreError::other(format!("threshold check failed: {}", e))
                        })?
                    } else {
                        false
                    };

                    Ok((added, threshold_met))
                })
            })
            .await
            .map_err(MultisigStoreError::Store)
    }

    /// Get all signatures for a transaction
    pub async fn get_transaction_signatures(
        &self,
        tx_id: Uuid,
    ) -> Result<Vec<SignatureInfo>, MultisigStoreError> {
        store::fetch_signatures_by_tx_id(&mut self.get_conn().await?, tx_id)
            .await?
            .into_iter()
            .map(SignatureRecord::dissolve)
            .map(
                |SignatureRecordDissolved {
                     tx_id, approver_address, signature_bytes, ..
                 }| {
                    SignatureInfo::builder()
                        .tx_id(tx_id)
                        .approver_address(approver_address)
                        .sig(signature_bytes.into())
                        .build()
                },
            )
            .map(Ok)
            .collect()
    }

    /// Update transaction status (e.g., from pending to confirmed)
    pub async fn update_transaction_status(
        &self,
        tx_id: Uuid,
        new_status: &str,
    ) -> Result<(), MultisigStoreError> {
        let new_status = new_status
            .parse()
            .map_err(|e| MultisigStoreError::Other(format!("invalid status: {e}").into()))?;

        if !store::update_status_by_tx_id(&mut self.get_conn().await?, tx_id, new_status).await? {
            return Err(MultisigStoreError::NotFound(format!("tx id {tx_id} not found",).into()));
        }

        Ok(())
    }

    /// Create a new multisig contract
    pub async fn create_contract(
        &self,
        multisig_account_address: &str,
        threshold: u32,
        kind: &str,
        approvers: Vec<&str>,
        pub_key_commits: &[&[u8]],
    ) -> Result<(), MultisigStoreError> {
        let kind = kind
            .parse()
            .map_err(|e| MultisigStoreError::Other(format!("invalid account kind: {e}").into()))?;

        self.get_conn()
            .await?
            .transaction(|conn| {
                Box::pin(async move {
                    let new_contract = NewMultisigAccountRecord::builder()
                        .address(multisig_account_address)
                        .threshold(threshold as i64)
                        .kind(kind)
                        .build();

                    store::save_new_multisig_contract(conn, new_contract).await?;

                    for (address, pub_key_commit) in approvers.iter().zip(pub_key_commits.iter()) {
                        let new_approver = NewApproverRecord::builder()
                            .address(address)
                            .pub_key_commit(pub_key_commit)
                            .build();

                        store::upsert_approver(conn, new_approver).await?;
                    }

                    for (address, _) in approvers.iter().zip(pub_key_commits.iter()) {
                        store::save_new_multisig_account_approver_mapping(
                            conn,
                            multisig_account_address,
                            address,
                        )
                        .await?;
                    }

                    Ok(())
                })
            })
            .await
            .map_err(MultisigStoreError::Store)?;

        Ok(())
    }

    async fn get_conn(&self) -> Result<DbConn> {
        self.pool.get().await.map_err(|_| MultisigStoreError::Pool)
    }

    /// Check if a transaction has met its threshold
    pub async fn is_threshold_met(&self, tx_id: Uuid) -> Result<bool, MultisigStoreError> {
        let conn = &mut self.get_conn().await?;
        Self::check_threshold_met_internal(conn, tx_id).await
    }

    // Internal method to check threshold within a transaction
    async fn check_threshold_met_internal(
        conn: &mut DbConn,
        tx_id: Uuid,
    ) -> Result<bool, MultisigStoreError> {
        let Some(TxRecordDissolved { multisig_account_address, .. }) =
            store::fetch_tx_by_id(conn, tx_id).await?.map(TxRecord::dissolve)
        else {
            return Err(MultisigStoreError::NotFound(format!("tx id {tx_id} not found").into()));
        };

        let Some(MultisigAccountRecordDissolved { threshold, .. }) =
            store::fetch_mutisig_account_by_address(conn, &multisig_account_address)
                .await?
                .map(MultisigAccountRecord::dissolve)
        else {
            return Err(MultisigStoreError::NotFound(
                format!("contract {multisig_account_address} not found").into(),
            ));
        };

        let signatures = store::fetch_signatures_by_tx_id(conn, tx_id).await?;

        // Check if signature count meets or exceeds threshold
        Ok(signatures.len() as i64 >= threshold)
    }

    /// Process transaction when threshold is met (update status to CONFIRMED)
    pub async fn process_transaction_threshold_met(
        &self,
        tx_id: Uuid,
    ) -> Result<(), MultisigStoreError> {
        // First verify threshold is actually met
        if !self.is_threshold_met(tx_id).await? {
            return Err(MultisigStoreError::InvalidValue);
        }

        // Update transaction status to CONFIRMED
        self.update_transaction_status(tx_id, "CONFIRMED").await?;

        Ok(())
    }

    /// Get transaction details with threshold information
    pub async fn get_transaction_with_threshold_info(
        &self,
        id: Uuid,
    ) -> Result<Option<TransactionThresholdInfo>, MultisigStoreError> {
        let conn = &mut self.get_conn().await?;

        let Some(TxRecordDissolved {
            id,
            multisig_account_address,
            status,
            tx_summary,
            created_at,
            ..
        }) = store::fetch_tx_by_id(conn, id).await?.map(TxRecord::dissolve)
        else {
            return Ok(None);
        };

        let Some(MultisigAccountRecordDissolved { threshold, .. }) =
            store::fetch_mutisig_account_by_address(conn, &multisig_account_address)
                .await?
                .map(MultisigAccountRecord::dissolve)
        else {
            return Err(MultisigStoreError::NotFound(
                format!("multisig account {multisig_account_address} not found").into(),
            ));
        };

        let signatures = store::fetch_signatures_by_tx_id(conn, id).await?;

        let tx_threshold_info = TransactionThresholdInfo::builder()
            .tx_id(id)
            .contract_id(multisig_account_address)
            .status(status.to_string())
            .tx_summary(tx_summary.into())
            .threshold(threshold as u32)
            .sigs_count(signatures.len() as u32)
            .threshold_met(signatures.len() as i64 >= threshold)
            .created_at(created_at)
            .build();

        Ok(Some(tx_threshold_info))
    }
}
