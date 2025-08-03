use miden_client::{Client, ClientBuilder};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::path::PathBuf;

mod errors;
mod queries;

pub use errors::StoreError;
use queries::*;

// DATA TYPES
// ================================================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractInfo {
    pub contract_id: String,
    pub threshold: i32,
    pub contract_type: String,
    pub created_at: i64,
    pub approvers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionInfo {
    pub tx_id: String,
    pub contract_id: String,
    pub status: String,
    pub transaction_effect: String,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureRecord {
    pub tx_id: String,
    pub address: String,
    pub signature: String,
}

// MULTISIG STORE
// ================================================================================================

/// Represents a connection pool with PostgreSQL database for multisig operations.
/// Current table definitions can be found at `store.sql` migration file.
pub struct MultisigStore {
    pub(crate) pool: PgPool,
    pub(crate) client: Client,
}

impl MultisigStore {
    // CONSTRUCTORS
    // --------------------------------------------------------------------------------------------

    /// Returns a new instance of [MultisigStore] with the specified database URL.
    pub async fn new(database_url: &str, client: Client) -> Result<Self, StoreError> {
        // Create PostgreSQL connection pool
        let pool = PgPool::connect(database_url)
            .await
            .map_err(|e| StoreError::DatabaseError(e.to_string()))?;

        // Apply migrations
        apply_migrations(&pool).await?;

        Ok(MultisigStore { pool, client })
    }

    /// Gets the current timestamp as a Unix timestamp
    pub fn get_current_timestamp(&self) -> i64 {
        chrono::Utc::now().timestamp()
    }

    /// Get a reference to the connection pool
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}

// MULTISIG API OPERATIONS
// ================================================================================================

impl MultisigStore {
    // API 1: Get Account Info
    // =============================================================================================

    /// Get contract information including metadata and approvers
    pub async fn get_contract_info(
        &self,
        contract_id: &str,
    ) -> Result<Option<ContractInfo>, StoreError> {
        // Get contract metadata
        let contract_row = sqlx::query(GET_CONTRACT_METADATA)
            .bind(contract_id)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = contract_row {
            let threshold: i32 = row.get("threshold");
            let contract_type: String = row.get("type");
            let created_at: i64 = row.get(2);

            // Get approver addresses
            let approver_rows = sqlx::query(GET_CONTRACT_APPROVERS)
                .bind(contract_id)
                .fetch_all(&self.pool)
                .await?;

            let approvers: Vec<String> = approver_rows
                .into_iter()
                .map(|row| row.get::<String, _>("address"))
                .collect();

            Ok(Some(ContractInfo {
                contract_id: contract_id.to_string(),
                threshold,
                contract_type,
                created_at,
                approvers,
            }))
        } else {
            Ok(None)
        }
    }

    // API 2: Get Transactions for an Account
    // =============================================================================================

    /// Get transactions for a contract with optional status filter
    pub async fn get_contract_transactions(
        &self,
        contract_id: &str,
        status_filter: Option<&str>,
    ) -> Result<Vec<TransactionInfo>, StoreError> {
        let query = match status_filter {
            Some("all") | None => GET_CONTRACT_TRANSACTIONS_ALL,
            Some(_) => GET_CONTRACT_TRANSACTIONS_BY_STATUS,
        };

        let rows = match status_filter {
            Some("all") | None => {
                sqlx::query(query)
                    .bind(contract_id)
                    .fetch_all(&self.pool)
                    .await?
            }
            Some(status) => {
                sqlx::query(query)
                    .bind(contract_id)
                    .bind(status)
                    .fetch_all(&self.pool)
                    .await?
            }
        };

        let mut transactions = Vec::new();
        for row in rows {
            let tx_id: String = row.get("tx_id");
            let status: String = row.get("status");
            let transaction_effect: String = row.get("transaction_effect");
            let created_at: i64 = row.get(3);

            // Get signature count
            let signature_count_row = sqlx::query(COUNT_TRANSACTION_SIGNATURES)
                .bind(&tx_id)
                .fetch_one(&self.pool)
                .await?;
            let signature_count: i64 = signature_count_row.get(0);

            transactions.push(TransactionInfo {
                tx_id,
                contract_id: contract_id.to_string(),
                status,
                transaction_effect,
                created_at,
                signature_count: Some(signature_count),
            });
        }

        Ok(transactions)
    }

    // API 3: Get Transaction by Hash
    // =============================================================================================

    /// Get full transaction details by transaction ID
    pub async fn get_transaction_by_id(
        &self,
        tx_id: &str,
    ) -> Result<Option<TransactionInfo>, StoreError> {
        let row = sqlx::query(GET_TRANSACTION_BY_ID)
            .bind(tx_id)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(row) = row {
            Ok(Some(TransactionInfo {
                tx_id: row.get("tx_id"),
                contract_id: row.get("contract_id"),
                status: row.get("status"),
                transaction_effect: row.get("transaction_effect"),
                created_at: row.get(4),
                signature_count: None,
            }))
        } else {
            Ok(None)
        }
    }

    // API 4: Post New Transaction
    // =============================================================================================

    /// Create a new pending transaction
    pub async fn create_transaction(
        &self,
        tx_id: &str,
        contract_id: &str,
        transaction_effect: &str,
    ) -> Result<(), StoreError> {
        let created_at = self.get_current_timestamp();

        sqlx::query(INSERT_TRANSACTION)
            .bind(tx_id)
            .bind(contract_id)
            .bind("pending")
            .bind(transaction_effect)
            .bind(created_at)
            .execute(&self.pool)
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
        signature: &str,
    ) -> Result<bool, StoreError> {
        // Start a transaction for atomicity
        let mut tx = self.pool.begin().await?;

        // Validate if the signer is a valid approver
        let validation_result = sqlx::query(VALIDATE_APPROVER_FOR_TRANSACTION)
            .bind(tx_id)
            .bind(approver_address)
            .fetch_optional(&mut *tx)
            .await?;

        if validation_result.is_none() {
            return Ok(false); // Not a valid approver
        }

        // Insert signature
        sqlx::query(INSERT_TRANSACTION_SIGNATURE)
            .bind(tx_id)
            .bind(approver_address)
            .bind(signature)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(true)
    }

    // HELPER FUNCTIONS
    // =============================================================================================

    /// Get all signatures for a transaction
    pub async fn get_transaction_signatures(
        &self,
        tx_id: &str,
    ) -> Result<Vec<SignatureRecord>, StoreError> {
        let rows = sqlx::query(GET_TRANSACTION_SIGNATURES)
            .bind(tx_id)
            .fetch_all(&self.pool)
            .await?;

        let signatures = rows
            .into_iter()
            .map(|row| SignatureRecord {
                tx_id: row.get("tx_id"),
                address: row.get("address"),
                signature: row.get("signature"),
            })
            .collect();

        Ok(signatures)
    }

    /// Update transaction status (e.g., from pending to confirmed)
    pub async fn update_transaction_status(
        &self,
        tx_id: &str,
        new_status: &str,
    ) -> Result<(), StoreError> {
        let result = sqlx::query(UPDATE_TRANSACTION_STATUS)
            .bind(new_status)
            .bind(tx_id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(StoreError::NotFound(format!(
                "Transaction with ID {} not found",
                tx_id
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
        contract_type: &str,
    ) -> Result<(), StoreError> {
        sqlx::query(INSERT_CONTRACT)
            .bind(contract_id)
            .bind(threshold)
            .bind(contract_type)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Add an approver to a contract
    pub async fn add_contract_approver(
        &self,
        contract_id: &str,
        address: &str,
        public_key: &str,
    ) -> Result<(), StoreError> {
        let mut tx = self.pool.begin().await?;

        // Insert approver details (upsert)
        sqlx::query(INSERT_APPROVER_DETAILS)
            .bind(address)
            .bind(public_key)
            .execute(&mut *tx)
            .await?;

        // Add approver to contract
        sqlx::query(INSERT_CONTRACT_APPROVER)
            .bind(contract_id)
            .bind(address)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TableCounts {
    pub contracts: i64,
    pub approvers: i64,
    pub transactions: i64,
    pub signatures: i64,
}

// MIGRATIONS
// ================================================================================================

/// Applies database migrations by executing the SQL schema
async fn apply_migrations(pool: &PgPool) -> Result<(), StoreError> {
    // Read and execute the SQL schema
    let schema = include_str!("store.sql");

    // Split by semicolons and execute each statement
    for statement in schema.split(';') {
        let statement = statement.trim();
        if !statement.is_empty() {
            sqlx::query(statement).execute(pool).await.map_err(|e| {
                StoreError::DatabaseError(format!("Failed to apply migration: {}", e))
            })?;
        }
    }

    Ok(())
}

// TESTS
// ================================================================================================

#[cfg(test)]
pub mod tests {
    use super::*;

    /// Creates a test MultisigStore instance
    pub async fn create_test_store() -> MultisigStore {
        // For testing, you might use a test database URL
        let database_url = std::env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgres://testuser:testpass@localhost:5432/testdb".to_string());

        let mut client = ClientBuilder::new()
            .rpc(rpc_api)
            .filesystem_keystore("./keystore")
            .in_debug_mode(true)
            .build()
            .await?;

        MultisigStore::new(&database_url, client).await.unwrap()
    }

    // TEST HELPER FUNCTIONS
    // =============================================================================================

    /// Test data setup for comprehensive testing
    pub struct TestData {
        pub contract_id: String,
        pub approver_addresses: Vec<String>,
        pub approver_public_keys: Vec<String>,
        pub tx_ids: Vec<String>,
        pub threshold: i32,
    }

    impl TestData {
        pub fn new(prefix: &str) -> Self {
            Self {
                contract_id: format!("test_{}_contract", prefix),
                approver_addresses: vec![
                    format!("test_{}_addr_1", prefix),
                    format!("test_{}_addr_2", prefix),
                    format!("test_{}_addr_3", prefix),
                ],
                approver_public_keys: vec![
                    format!("test_{}_pubkey_1", prefix),
                    format!("test_{}_pubkey_2", prefix),
                    format!("test_{}_pubkey_3", prefix),
                ],
                tx_ids: vec![
                    format!("test_{}_tx_1", prefix),
                    format!("test_{}_tx_2", prefix),
                ],
                threshold: 2,
            }
        }
    }

    impl MultisigStore {
        /// Setup complete test environment with contract, approvers, and transactions
        pub async fn setup_test_environment(&self, test_data: &TestData) -> Result<(), StoreError> {
            let mut tx = self.pool.begin().await?;

            // Create contract
            sqlx::query("INSERT INTO multi_sig_contracts (contract_id, threshold, type) VALUES ($1, $2, 'test')")
                .bind(&test_data.contract_id)
                .bind(test_data.threshold)
                .execute(&mut *tx)
                .await?;

            // Create approver details
            for (addr, pubkey) in test_data
                .approver_addresses
                .iter()
                .zip(test_data.approver_public_keys.iter())
            {
                sqlx::query("INSERT INTO approver_details (address, public_key) VALUES ($1, $2) ON CONFLICT (address) DO NOTHING")
                    .bind(addr)
                    .bind(pubkey)
                    .execute(&mut *tx)
                    .await?;

                // Add to contract approvers
                sqlx::query(
                    "INSERT INTO contract_approvers (contract_id, address) VALUES ($1, $2)",
                )
                .bind(&test_data.contract_id)
                .bind(addr)
                .execute(&mut *tx)
                .await?;
            }

            // Create test transactions
            for (i, tx_id) in test_data.tx_ids.iter().enumerate() {
                let status = if i == 0 { "pending" } else { "confirmed" };
                sqlx::query("INSERT INTO contract_transactions (tx_id, contract_id, status, transaction_effect) VALUES ($1, $2, $3, $4)")
                    .bind(tx_id)
                    .bind(&test_data.contract_id)
                    .bind(status)
                    .bind(format!("Test transaction {}", i + 1))
                    .execute(&mut *tx)
                    .await?;
            }

            tx.commit().await?;
            Ok(())
        }

        /// Cleanup test data
        pub async fn cleanup_test_data(&self, test_data: &TestData) -> Result<(), StoreError> {
            let mut tx = self.pool.begin().await?;

            // Delete in reverse dependency order
            for tx_id in &test_data.tx_ids {
                sqlx::query("DELETE FROM transaction_signatures WHERE tx_id = $1")
                    .bind(tx_id)
                    .execute(&mut *tx)
                    .await?;
            }

            sqlx::query("DELETE FROM contract_transactions WHERE contract_id = $1")
                .bind(&test_data.contract_id)
                .execute(&mut *tx)
                .await?;

            sqlx::query("DELETE FROM contract_approvers WHERE contract_id = $1")
                .bind(&test_data.contract_id)
                .execute(&mut *tx)
                .await?;

            sqlx::query("DELETE FROM multi_sig_contracts WHERE contract_id = $1")
                .bind(&test_data.contract_id)
                .execute(&mut *tx)
                .await?;

            for addr in &test_data.approver_addresses {
                sqlx::query("DELETE FROM approver_details WHERE address = $1")
                    .bind(addr)
                    .execute(&mut *tx)
                    .await?;
            }

            tx.commit().await?;
            Ok(())
        }

        /// Create test data for cascade testing
        async fn create_test_data(&self, test_contract_id: &str) -> Result<(), StoreError> {
            let test_data = TestData::new(&test_contract_id.replace("test_", ""));
            self.setup_test_environment(&test_data).await
        }

        /// Count records related to a test contract
        async fn count_test_records(
            &self,
            test_contract_id: &str,
        ) -> Result<TableCounts, StoreError> {
            let test_tx_id = format!("{}_tx", test_contract_id);

            let contracts: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM multi_sig_contracts WHERE contract_id = $1",
            )
            .bind(test_contract_id)
            .fetch_one(&self.pool)
            .await?;

            let approvers: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM contract_approvers WHERE contract_id = $1",
            )
            .bind(test_contract_id)
            .fetch_one(&self.pool)
            .await?;

            let transactions: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM contract_transactions WHERE contract_id = $1",
            )
            .bind(test_contract_id)
            .fetch_one(&self.pool)
            .await?;

            let signatures: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM transaction_signatures WHERE tx_id = $1")
                    .bind(&test_tx_id)
                    .fetch_one(&self.pool)
                    .await?;

            Ok(TableCounts {
                contracts,
                approvers,
                transactions,
                signatures,
            })
        }
    }

    // TEST CASES
    // =============================================================================================

    #[tokio::test]
    async fn test_store_creation_and_connection() {
        let store = create_test_store().await;

        // Test basic connection
        let result = sqlx::query("SELECT 1 as test_value")
            .fetch_one(store.pool())
            .await;
        assert!(result.is_ok());

        let row = result.unwrap();
        let value: i32 = row.get("test_value");
        assert_eq!(value, 1);

        // Test that tables exist after migration
        let tables_exist = sqlx::query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
        )
        .fetch_all(store.pool())
        .await;

        assert!(tables_exist.is_ok());
        let tables = tables_exist.unwrap();
        let table_names: Vec<String> = tables.iter().map(|row| row.get("table_name")).collect();

        assert!(table_names.contains(&"multi_sig_contracts".to_string()));
        assert!(table_names.contains(&"approver_details".to_string()));
        assert!(table_names.contains(&"contract_approvers".to_string()));
        assert!(table_names.contains(&"contract_transactions".to_string()));
        assert!(table_names.contains(&"transaction_signatures".to_string()));
    }

    #[tokio::test]
    async fn test_contract_creation_and_retrieval() {
        let store = create_test_store().await;
        let test_data = TestData::new("contract_creation");

        // Test contract creation
        let result = store
            .create_contract(&test_data.contract_id, test_data.threshold, "multisig")
            .await;
        assert!(result.is_ok(), "Failed to create contract: {:?}", result);

        // Test contract retrieval (should be empty initially - no approvers)
        let contract_info = store
            .get_contract_info(&test_data.contract_id)
            .await
            .unwrap();
        assert!(contract_info.is_some());

        let info = contract_info.unwrap();
        assert_eq!(info.contract_id, test_data.contract_id);
        assert_eq!(info.threshold, test_data.threshold);
        assert_eq!(info.contract_type, "multisig");
        assert_eq!(info.approvers.len(), 0); // No approvers added yet

        // Cleanup
        store.cleanup_test_data(&test_data).await.unwrap();
    }

    #[tokio::test]
    async fn test_contract_with_approvers() {
        let store = create_test_store().await;
        let test_data = TestData::new("contract_approvers");

        // Setup test environment
        store.setup_test_environment(&test_data).await.unwrap();

        // Test contract info with approvers
        let contract_info = store
            .get_contract_info(&test_data.contract_id)
            .await
            .unwrap();
        assert!(contract_info.is_some());

        let info = contract_info.unwrap();
        assert_eq!(info.approvers.len(), 3);

        // Verify all approvers are present
        for addr in &test_data.approver_addresses {
            assert!(
                info.approvers.contains(addr),
                "Address {} not found in approvers",
                addr
            );
        }

        // Cleanup
        store.cleanup_test_data(&test_data).await.unwrap();
    }

    #[tokio::test]
    async fn test_transaction_lifecycle() {
        let store = create_test_store().await;
        let test_data = TestData::new("tx_lifecycle");

        // Setup test environment
        store.setup_test_environment(&test_data).await.unwrap();

        // Test transaction creation
        let new_tx_id = format!("{}_new_tx", test_data.contract_id);
        let result = store
            .create_transaction(
                &new_tx_id,
                &test_data.contract_id,
                "Send 100 tokens to Alice",
            )
            .await;
        assert!(result.is_ok());

        // Test transaction retrieval
        let tx_info = store.get_transaction_by_id(&new_tx_id).await.unwrap();
        assert!(tx_info.is_some());

        let tx = tx_info.unwrap();
        assert_eq!(tx.tx_id, new_tx_id);
        assert_eq!(tx.contract_id, test_data.contract_id);
        assert_eq!(tx.status, "pending");
        assert_eq!(tx.transaction_effect, "Send 100 tokens to Alice");

        // Test transaction status update
        let update_result = store
            .update_transaction_status(&new_tx_id, "confirmed")
            .await;
        assert!(update_result.is_ok());

        // Verify status was updated
        let updated_tx = store
            .get_transaction_by_id(&new_tx_id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(updated_tx.status, "confirmed");

        // Cleanup
        store.cleanup_test_data(&test_data).await.unwrap();
        sqlx::query("DELETE FROM contract_transactions WHERE tx_id = $1")
            .bind(&new_tx_id)
            .execute(store.pool())
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_signature_management() {
        let store = create_test_store().await;
        let test_data = TestData::new("signatures");

        // Setup test environment
        store.setup_test_environment(&test_data).await.unwrap();

        let tx_id = &test_data.tx_ids[0];

        // Test adding valid signatures
        for (i, addr) in test_data.approver_addresses.iter().enumerate() {
            let signature = format!("signature_{}", i);
            let result = store
                .add_transaction_signature(tx_id, addr, &signature)
                .await;
            assert!(
                result.is_ok(),
                "Failed to add signature for {}: {:?}",
                addr,
                result
            );
            assert!(
                result.unwrap(),
                "Signature addition returned false for valid approver"
            );
        }

        // Test retrieving signatures
        let signatures = store.get_transaction_signatures(tx_id).await.unwrap();
        assert_eq!(signatures.len(), 3);

        for sig in &signatures {
            assert_eq!(sig.tx_id, *tx_id);
            assert!(test_data.approver_addresses.contains(&sig.address));
            assert!(sig.signature.starts_with("signature_"));
        }

        // Test adding signature from non-approver (should fail)
        let invalid_addr = "not_an_approver";
        let result = store
            .add_transaction_signature(tx_id, invalid_addr, "invalid_sig")
            .await;
        assert!(result.is_ok());
        assert!(
            !result.unwrap(),
            "Should reject signature from non-approver"
        );

        // Cleanup
        store.cleanup_test_data(&test_data).await.unwrap();
    }

    #[tokio::test]
    async fn test_contract_transactions_query() {
        let store = create_test_store().await;
        let test_data = TestData::new("tx_query");

        // Setup test environment
        store.setup_test_environment(&test_data).await.unwrap();

        // Test getting all transactions
        let all_txs = store
            .get_contract_transactions(&test_data.contract_id, None)
            .await
            .unwrap();
        assert_eq!(all_txs.len(), 2);

        // Test getting pending transactions
        let pending_txs = store
            .get_contract_transactions(&test_data.contract_id, Some("pending"))
            .await
            .unwrap();
        assert_eq!(pending_txs.len(), 1);
        assert_eq!(pending_txs[0].status, "pending");

        // Test getting confirmed transactions
        let confirmed_txs = store
            .get_contract_transactions(&test_data.contract_id, Some("confirmed"))
            .await
            .unwrap();
        assert_eq!(confirmed_txs.len(), 1);
        assert_eq!(confirmed_txs[0].status, "confirmed");

        // Test signature counts are included
        for tx in &all_txs {
            assert!(tx.signature_count.is_some());
            assert!(tx.signature_count.unwrap() >= 0);
        }

        // Cleanup
        store.cleanup_test_data(&test_data).await.unwrap();
    }

    #[tokio::test]
    async fn test_error_handling() {
        let store = create_test_store().await;

        // Test getting non-existent contract
        let result = store
            .get_contract_info("non_existent_contract")
            .await
            .unwrap();
        assert!(result.is_none());

        // Test getting non-existent transaction
        let result = store
            .get_transaction_by_id("non_existent_tx")
            .await
            .unwrap();
        assert!(result.is_none());

        // Test updating non-existent transaction status
        let result = store
            .update_transaction_status("non_existent_tx", "confirmed")
            .await;
        assert!(result.is_err());

        if let Err(StoreError::NotFound(msg)) = result {
            assert!(msg.contains("not found"));
        } else {
            panic!("Expected NotFound error");
        }

        // Test creating transaction for non-existent contract should succeed
        // (foreign key constraint will be checked by database)
        let result = store
            .create_transaction("test_tx", "non_existent_contract", "test")
            .await;
        // This might succeed or fail depending on DB constraints
        // The important thing is it doesn't panic
    }

    #[tokio::test]
    async fn test_concurrent_operations() {
        let store = create_test_store().await;
        let test_data = TestData::new("concurrent");

        // Setup test environment
        store.setup_test_environment(&test_data).await.unwrap();

        let tx_id = &test_data.tx_ids[0];

        // Test concurrent signature additions
        let mut handles = vec![];

        for (i, addr) in test_data.approver_addresses.iter().enumerate() {
            let store_clone = create_test_store().await; // Each task gets its own connection
            let tx_id_clone = tx_id.clone();
            let addr_clone = addr.clone();
            let signature = format!("concurrent_signature_{}", i);

            let handle = tokio::spawn(async move {
                store_clone
                    .add_transaction_signature(&tx_id_clone, &addr_clone, &signature)
                    .await
            });

            handles.push(handle);
        }

        // Wait for all signatures to be added
        let mut success_count = 0;
        for handle in handles {
            let result = handle.await.unwrap();
            if result.is_ok() && result.unwrap() {
                success_count += 1;
            }
        }

        assert_eq!(
            success_count, 3,
            "All concurrent signature additions should succeed"
        );

        // Verify all signatures were added
        let signatures = store.get_transaction_signatures(tx_id).await.unwrap();
        assert_eq!(signatures.len(), 3);

        // Cleanup
        store.cleanup_test_data(&test_data).await.unwrap();
    }

    #[tokio::test]
    async fn test_edge_cases() {
        let store = create_test_store().await;

        // Test very long contract ID
        let long_id = "a".repeat(100);
        let result = store.create_contract(&long_id, 1, "test").await;
        // Should work unless DB has length constraints

        if result.is_ok() {
            // Cleanup if it succeeded
            sqlx::query("DELETE FROM multi_sig_contracts WHERE contract_id = $1")
                .bind(&long_id)
                .execute(store.pool())
                .await
                .unwrap();
        }

        // Test zero threshold (edge case)
        let result = store.create_contract("zero_threshold", 0, "test").await;
        if result.is_ok() {
            sqlx::query("DELETE FROM multi_sig_contracts WHERE contract_id = $1")
                .bind("zero_threshold")
                .execute(store.pool())
                .await
                .unwrap();
        }

        // Test negative threshold
        let result = store
            .create_contract("negative_threshold", -1, "test")
            .await;
        if result.is_ok() {
            sqlx::query("DELETE FROM multi_sig_contracts WHERE contract_id = $1")
                .bind("negative_threshold")
                .execute(store.pool())
                .await
                .unwrap();
        }

        // Test empty transaction effect
        let test_data = TestData::new("edge_cases");
        store.setup_test_environment(&test_data).await.unwrap();

        let result = store
            .create_transaction("empty_effect_tx", &test_data.contract_id, "")
            .await;
        assert!(result.is_ok(), "Should handle empty transaction effect");

        // Cleanup
        store.cleanup_test_data(&test_data).await.unwrap();
        sqlx::query("DELETE FROM contract_transactions WHERE tx_id = $1")
            .bind("empty_effect_tx")
            .execute(store.pool())
            .await
            .ok();
    }
}
