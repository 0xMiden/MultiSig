//! This crate defines the interactions with the persistence layer i.e. the database.

/// Payload structs.
pub mod types;

mod errors;
mod persistence;

use crate::persistence::record::select::{
    ContractTxRecordDissolved, MultisigContractRecordDissolved, TxSigRecordDissolved,
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
                NewApproverRecord, NewContractTxRecord, NewMultisigContractRecord, NewTxSigRecord,
            },
            select::{ContractTxRecord, MultisigContractRecord, TxSigRecord},
        },
        store::{self, StoreError},
    },
    types::{ContractInfo, SignatureRecord, TransactionInfo, TransactionThresholdInfo},
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
    /// Get contract information including metadata and approvers
    pub async fn get_contract_info(&self, contract_id: &str) -> Result<Option<ContractInfo>> {
        let conn = &mut self.get_conn().await?;

        let Some(MultisigContractRecordDissolved { contract_id, threshold, kind, created_at }) =
            store::fetch_mutisig_contract_by_contract_id(conn, contract_id)
                .await?
                .map(MultisigContractRecord::dissolve)
        else {
            return Ok(None);
        };

        let approvers = store::fetch_contract_approvers_by_contract_id(conn, &contract_id).await?;

        let contract_info = ContractInfo::builder()
            .contract_id(contract_id)
            .approvers(approvers)
            .threshold(threshold.try_into().map_err(|_| MultisigStoreError::InvalidValue)?)
            .kind(kind)
            .created_at(created_at)
            .build();

        Ok(Some(contract_info))
    }

    /// Get transactions for a contract with optional status filter
    pub async fn get_contract_transactions(
        &self,
        contract_id: &str,
        status_filter: Option<&str>,
    ) -> Result<Vec<TransactionInfo>, MultisigStoreError> {
        let conn = &mut self.get_conn().await?;

        let txs_with_sigs_count = match status_filter {
            Some(status) => {
                store::fetch_txs_with_sigs_count_by_contract_id_and_tx_status(
                    conn,
                    contract_id,
                    status,
                )
                .await?
            },
            None => store::fetch_txs_with_sigs_count_by_contract_id(conn, contract_id).await?,
        };

        txs_with_sigs_count
            .into_iter()
            .map(|(tx, count)| (tx.dissolve(), count))
            .map(
                |(
                    ContractTxRecordDissolved {
                        tx_id,
                        contract_id,
                        status,
                        tx_bz,
                        tx_summary,
                        tx_summary_commitment,
                        created_at,
                    },
                    count,
                )| {
                    let tx_info = TransactionInfo::builder()
                        .tx_id(tx_id)
                        .contract_id(contract_id)
                        .status(status)
                        .tx_bz(tx_bz.into())
                        .tx_summary(tx_summary.into())
                        .tx_summary_commitment(tx_summary_commitment.into())
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
    pub async fn get_transaction_by_id(&self, tx_id: Uuid) -> Result<Option<TransactionInfo>> {
        let conn = &mut self.get_conn().await?;

        let Some(ContractTxRecordDissolved {
            tx_id,
            contract_id,
            status,
            tx_bz,
            tx_summary,
            tx_summary_commitment,
            created_at,
        }) = store::fetch_tx_by_tx_id(conn, tx_id).await?.map(ContractTxRecord::dissolve)
        else {
            return Ok(None);
        };

        let tx_info = TransactionInfo::builder()
            .tx_id(tx_id)
            .contract_id(contract_id)
            .status(status)
            .tx_bz(tx_bz.into())
            .tx_summary(tx_summary.into())
            .tx_summary_commitment(tx_summary_commitment.into())
            .created_at(created_at)
            .build();

        Ok(Some(tx_info))
    }

    /// Create a new pending transaction
    pub async fn create_transaction(
        &self,
        contract_id: &str,
        tx_bz: &[u8],
        tx_summary: &[u8],
        tx_summary_commitment: &[u8],
    ) -> Result<(), MultisigStoreError> {
        let new_tx = NewContractTxRecord::builder()
            .contract_id(contract_id)
            .status("PENDING")
            .tx_bz(tx_bz)
            .tx_summary(tx_summary)
            .tx_summary_commitment(tx_summary_commitment)
            .build();

        self.get_conn()
            .await?
            .transaction(|conn| Box::pin(store::save_new_contract_tx(conn, new_tx)))
            .await?;

        Ok(())
    }

    /// Add a signature to a transaction (with validation)
    /// Returns (signature_added, threshold_met)
    pub async fn add_transaction_signature(
        &self,
        tx_id: Uuid,
        approver_address: &str,
        sig: &[u8],
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
                        let new_tx_sig = NewTxSigRecord::builder()
                            .tx_id(tx_id)
                            .approver_address(approver_address)
                            .sig(sig)
                            .build();

                        store::save_new_tx_sig(conn, new_tx_sig).await?;

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
    ) -> Result<Vec<SignatureRecord>, MultisigStoreError> {
        store::fetch_tx_sigs_by_tx_id(&mut self.get_conn().await?, tx_id)
            .await?
            .into_iter()
            .map(TxSigRecord::dissolve)
            .map(|TxSigRecordDissolved { tx_id, approver_address, sig, .. }| {
                SignatureRecord::builder()
                    .tx_id(tx_id)
                    .approver_address(approver_address)
                    .sig(sig.into())
                    .build()
            })
            .map(Ok)
            .collect()
    }

    /// Update transaction status (e.g., from pending to confirmed)
    pub async fn update_transaction_status(
        &self,
        tx_id: Uuid,
        new_status: &str,
    ) -> Result<(), MultisigStoreError> {
        if !store::update_status_by_contract_tx_status(
            &mut self.get_conn().await?,
            tx_id,
            new_status,
        )
        .await?
        {
            return Err(MultisigStoreError::NotFound(format!("tx id {tx_id} not found",).into()));
        }

        Ok(())
    }

    /// Create a new multisig contract
    pub async fn create_contract(
        &self,
        contract_id: &str,
        threshold: u32,
        kind: &str,
        approver_address: Vec<&str>,
        public_key: &[&[u8]],
    ) -> Result<(), MultisigStoreError> {
        self.get_conn()
            .await?
            .transaction(|conn| {
                Box::pin(async move {
                    let new_contract = NewMultisigContractRecord::builder()
                        .id(contract_id)
                        .threshold(threshold as i32)
                        .kind(kind)
                        .build();

                    store::save_new_multisig_contract(conn, new_contract).await?;

                    for (address, public_key) in approver_address.iter().zip(public_key.iter()) {
                        let new_approver = NewApproverRecord { address, public_key };

                        store::upsert_approver(conn, new_approver).await?;
                    }

                    for (address, _) in approver_address.iter().zip(public_key.iter()) {
                        store::save_new_contract_approver_mapping(conn, contract_id, address)
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

    /// Check if a transaction has met its threshold (public method)
    pub async fn is_threshold_met(&self, tx_id: Uuid) -> Result<bool, MultisigStoreError> {
        let conn = &mut self.get_conn().await?;
        Self::check_threshold_met_internal(conn, tx_id).await
    }

    // Internal method to check threshold within a transaction
    async fn check_threshold_met_internal(
        conn: &mut DbConn,
        tx_id: Uuid,
    ) -> Result<bool, MultisigStoreError> {
        let Some(ContractTxRecordDissolved { contract_id, .. }) =
            store::fetch_tx_by_tx_id(conn, tx_id).await?.map(ContractTxRecord::dissolve)
        else {
            return Err(MultisigStoreError::NotFound(format!("tx id {tx_id} not found").into()));
        };

        let Some(MultisigContractRecordDissolved { threshold, .. }) =
            store::fetch_mutisig_contract_by_contract_id(conn, &contract_id)
                .await?
                .map(MultisigContractRecord::dissolve)
        else {
            return Err(MultisigStoreError::NotFound(
                format!("contract {contract_id} not found").into(),
            ));
        };

        let signatures = store::fetch_tx_sigs_by_tx_id(conn, tx_id).await?;

        // Check if signature count meets or exceeds threshold
        Ok(signatures.len() as i32 >= threshold)
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
        tx_id: Uuid,
    ) -> Result<Option<TransactionThresholdInfo>, MultisigStoreError> {
        let conn = &mut self.get_conn().await?;

        let Some(ContractTxRecordDissolved {
            contract_id,
            tx_id,
            status,
            tx_summary,
            created_at,
            ..
        }) = store::fetch_tx_by_tx_id(conn, tx_id).await?.map(ContractTxRecord::dissolve)
        else {
            return Ok(None);
        };

        let Some(MultisigContractRecordDissolved { threshold, .. }) =
            store::fetch_mutisig_contract_by_contract_id(conn, &contract_id)
                .await?
                .map(MultisigContractRecord::dissolve)
        else {
            return Err(MultisigStoreError::NotFound(
                format!("contract {contract_id} not found").into(),
            ));
        };

        let signatures = store::fetch_tx_sigs_by_tx_id(conn, tx_id).await?;

        let tx_threshold_info = TransactionThresholdInfo::builder()
            .tx_id(tx_id)
            .contract_id(contract_id)
            .status(status)
            .tx_summary(tx_summary.into())
            .threshold(threshold as u32)
            .sigs_count(signatures.len() as u32)
            .threshold_met(signatures.len() as i32 >= threshold)
            .created_at(created_at)
            .build();

        Ok(Some(tx_threshold_info))
    }
}
