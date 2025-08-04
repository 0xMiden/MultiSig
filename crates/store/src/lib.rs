mod persistence;

mod errors;

pub use self::errors::MultisigStoreError;

use core::num::NonZeroU64;

use chrono::{DateTime, Utc};
use diesel_async::AsyncConnection;
use miden_client::Client;
use serde::{Deserialize, Serialize};

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
        store,
    },
};

// DATA TYPES
// ================================================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractInfo {
    pub contract_id: String,
    pub threshold: u32,
    pub contract_type: String,
    pub created_at: DateTime<Utc>,
    pub approvers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionInfo {
    pub tx_id: String,
    pub contract_id: String,
    pub status: String,
    pub effect: String,
    pub created_at: DateTime<Utc>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub sigs_count: Option<NonZeroU64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureRecord {
    pub tx_id: String,
    pub approver_address: String,
    pub sig: String,
}

// MULTISIG STORE
// ================================================================================================

/// Represents a connection pool with PostgreSQL database for multisig operations.
/// Current table definitions can be found at `store.sql` migration file.
pub struct MultisigStore {
    client: Client,
    pool: DbPool,
}

impl MultisigStore {
    /// Returns a new instance of [MultisigStore] with the specified database URL.
    pub async fn new(pool: DbPool, client: Client) -> Self {
        MultisigStore { pool, client }
    }

    /// Gets the current timestamp as a Unix timestamp
    pub fn get_current_timestamp(&self) -> i64 {
        chrono::Utc::now().timestamp()
    }

    pub fn client(&self) -> &Client {
        &self.client
    }
}

impl MultisigStore {
    /// Get contract information including metadata and approvers
    pub async fn get_contract_info(&self, contract_id: &str) -> Result<Option<ContractInfo>> {
        let conn = &mut self.get_conn().await?;

        let Some(contract) =
            store::fetch_mutisig_contract_by_contract_id(conn, contract_id).await?
        else {
            return Ok(None);
        };

        let approvers = store::fetch_contract_approvers_by_contract_id(conn, contract_id).await?;

        let MultisigContractRecord {
            contract_id,
            threshold,
            kind,
            created_at,
        } = contract;

        Ok(Some(ContractInfo {
            contract_id,
            threshold: threshold
                .try_into()
                .map_err(|_| MultisigStoreError::InvalidValue)?,
            contract_type: kind,
            created_at,
            approvers,
        }))
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
            }
            None => store::fetch_txs_with_sigs_count_by_contract_id(conn, contract_id).await?,
        };

        txs_with_sigs_count
            .into_iter()
            .map(
                |(
                    ContractTxRecord {
                        tx_id,
                        contract_id,
                        status,
                        effect,
                        created_at,
                    },
                    count,
                )| {
                    let tx_info = TransactionInfo {
                        tx_id,
                        contract_id,
                        status,
                        effect,
                        created_at,
                        sigs_count: count
                            .try_into()
                            .map(NonZeroU64::new)
                            .map_err(|_| MultisigStoreError::InvalidValue)?,
                    };

                    Ok(tx_info)
                },
            )
            .collect()
    }

    // API 3: Get Transaction by Hash
    // =============================================================================================

    /// Get full transaction details by transaction ID
    pub async fn get_transaction_by_id(&self, tx_id: &str) -> Result<Option<TransactionInfo>> {
        let conn = &mut self.get_conn().await?;

        let Some(ContractTxRecord {
            tx_id,
            contract_id,
            status,
            effect,
            created_at,
        }) = store::fetch_tx_by_tx_id(conn, tx_id).await?
        else {
            return Ok(None);
        };

        Ok(Some(TransactionInfo {
            tx_id,
            contract_id,
            status,
            effect,
            created_at,
            sigs_count: None,
        }))
    }

    // API 4: Post New Transaction
    // =============================================================================================

    /// Create a new pending transaction
    pub async fn create_transaction(
        &self,
        tx_id: &str,
        contract_id: &str,
        effect: &str,
    ) -> Result<(), MultisigStoreError> {
        let new_tx = NewContractTxRecord {
            id: tx_id,
            contract_id,
            status: "PENDING",
            effect,
            created_at: None,
        };

        self.get_conn()
            .await?
            .transaction(|conn| Box::pin(store::save_new_contract_tx(conn, new_tx)))
            .await?;

        Ok(())
    }

    // API 5: Post Signature for Transaction
    // =============================================================================================

    /// Add a signature to a transaction (with validation)
    pub async fn add_transaction_signature(
        &self,
        tx_id: &str,
        approver_address: &str,
        sig: &str,
    ) -> Result<bool, MultisigStoreError> {
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
                        let new_tx_sig = NewTxSigRecord {
                            tx_id,
                            approver_address,
                            sig,
                            created_at: None,
                        };

                        store::save_new_tx_sig(conn, new_tx_sig).await?;

                        true
                    };

                    Ok(added)
                })
            })
            .await
            .map_err(MultisigStoreError::Store)
    }

    /// Get all signatures for a transaction
    pub async fn get_transaction_signatures(
        &self,
        tx_id: &str,
    ) -> Result<Vec<SignatureRecord>, MultisigStoreError> {
        store::fetch_tx_sigs_by_tx_id(&mut self.get_conn().await?, tx_id)
            .await?
            .into_iter()
            .map(
                |TxSigRecord {
                     tx_id,
                     approver_address,
                     sig,
                     ..
                 }| {
                    SignatureRecord {
                        tx_id,
                        approver_address,
                        sig,
                    }
                },
            )
            .map(Ok)
            .collect()
    }

    /// Update transaction status (e.g., from pending to confirmed)
    pub async fn update_transaction_status(
        &self,
        tx_id: &str,
        new_status: &str,
    ) -> Result<(), MultisigStoreError> {
        if !store::update_status_by_contract_tx_status(
            &mut self.get_conn().await?,
            tx_id,
            new_status,
        )
        .await?
        {
            return Err(MultisigStoreError::NotFound(format!(
                "tx id {tx_id} not found",
            )));
        }

        Ok(())
    }

    // CONTRACT MANAGEMENT (BONUS)
    // =============================================================================================

    /// Create a new multisig contract
    pub async fn create_contract(
        &self,
        contract_id: &str,
        threshold: i32,
        kind: &str,
    ) -> Result<(), MultisigStoreError> {
        let new_contract = NewMultisigContractRecord {
            id: contract_id,
            threshold,
            kind,
            created_at: None,
        };

        store::save_new_multisig_contract(&mut self.get_conn().await?, new_contract).await?;

        Ok(())
    }

    /// Add an approver to a contract
    pub async fn add_contract_approver(
        &self,
        contract_id: &str,
        address: &str,
        public_key: &str,
    ) -> Result<(), MultisigStoreError> {
        self.get_conn()
            .await?
            .transaction(|conn| {
                Box::pin(async move {
                    let new_approver = NewApproverRecord {
                        address,
                        public_key,
                    };

                    store::upsert_approver(conn, new_approver).await?;

                    store::save_new_contract_approver_mapping(conn, contract_id, address).await?;
                    Ok(())
                })
            })
            .await
            .map_err(MultisigStoreError::Store)
    }

    async fn get_conn(&self) -> Result<DbConn> {
        self.pool.get().await.map_err(|_| MultisigStoreError::Pool)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TableCounts {
    pub contracts: i64,
    pub approvers: i64,
    pub transactions: i64,
    pub signatures: i64,
}
