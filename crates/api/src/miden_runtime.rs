use rand::RngCore;
use std::sync::Arc;

use miden_client::{
    Client,
    account::{
        AccountBuilder, AccountId, AccountStorageMode, AccountType,
        component::{BasicFungibleFaucet, BasicWallet, RpoFalcon512},
    },
    auth::AuthSecretKey,
    builder::ClientBuilder,
    crypto::SecretKey,
    keystore::FilesystemKeyStore,
    rpc::{Endpoint, TonicRpcClient},
    transaction::TransactionRequest,
};

use miden_tx::utils::{
    ByteReader, ByteWriter, Deserializable, DeserializationError, Serializable, hex_to_bytes,
};

use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, oneshot};
use tracing::info;

/// Messages that can be sent to the miden client runtime
#[derive(Debug)]
pub enum MidenMessage {
    /// Create a new multisig account using miden client
    CreateMultisigAccount {
        threshold: u32,
        approvers: Vec<ApproverInfo>,
        response: oneshot::Sender<Result<String, String>>,
    },
    /// Process transaction data
    ProcessTransaction {
        tx_data: String,
        account_id: String,
        signature: Vec<String>,
        response: oneshot::Sender<Result<String, String>>,
    },
    /// Shutdown the miden runtime
    Shutdown,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ApproverInfo {
    pub public_key: String,
    pub address: String,
}

/// Miden client runtime that handles all miden operations in a separate task
pub struct MidenRuntime {
    /// Handle to the tokio task running the miden client
    task_handle: tokio::task::JoinHandle<()>,
}

impl MidenRuntime {
    /// Creates and starts a new miden client runtime
    pub async fn new(
        message_receiver: mpsc::UnboundedReceiver<MidenMessage>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        info!("🚀 Initializing Miden Runtime...");

        // Spawn the dedicated tokio task for miden client
        // Use spawn_local for non-Send futures (miden client is not Send/Sync)
        let task_handle = tokio::task::spawn_local(Self::run_miden_runtime(message_receiver));

        info!("✅ Miden Runtime started successfully");

        Ok(Self { task_handle })
    }

    /// Shutdown the miden runtime
    pub async fn shutdown(self) -> Result<(), Box<dyn std::error::Error>> {
        info!("🛑 Shutting down Miden Runtime...");

        // Wait for the task to complete
        self.task_handle.await?;

        info!("✅ Miden Runtime shutdown complete");
        Ok(())
    }

    /// Main runtime loop that processes miden client messages
    async fn run_miden_runtime(mut message_receiver: mpsc::UnboundedReceiver<MidenMessage>) {
        info!("🏃 Starting Miden client runtime loop...");

        // Try to initialize the miden client
        let miden_client_result = Self::create_miden_client().await;

        match miden_client_result {
            Ok(mut miden_client) => {
                info!("✅ Miden client initialized successfully");

                // Process messages in the runtime loop
                while let Some(message) = message_receiver.recv().await {
                    match &message {
                        MidenMessage::Shutdown => {
                            info!("🛑 Received shutdown signal, stopping runtime");
                            break;
                        }
                        _ => {
                            tracing::info!("Handling miden message: {:?}", message);
                            Self::handle_miden_message(&mut miden_client, message).await;
                        }
                    }
                }
            }
            Err(e) => {
                info!("❌ Failed to initialize miden client: {}", e);
                info!("🔄 Running in fallback mode - operations will return mock responses");
            }
        }

        info!("🏁 Miden client runtime stopped");
    }

    /// Create miden client - this runs entirely within the spawned task
    async fn create_miden_client() -> Result<Client, String> {
        info!("🔧 Initializing miden client...");

        // Initialize client & keystore
        let endpoint = Endpoint::testnet();
        let timeout_ms = 10_000;
        let rpc_api = Arc::new(TonicRpcClient::new(&endpoint, timeout_ms));

        let miden_client = ClientBuilder::new()
            .rpc(rpc_api)
            .filesystem_keystore("./keystore")
            .in_debug_mode(true)
            .build()
            .await
            .map_err(|e| format!("Failed to build miden client: {}", e))?;

        info!("✅ Miden client created successfully");
        Ok(miden_client)
    }

    /// Handle individual miden client messages using real miden client
    async fn handle_miden_message(client: &mut Client, message: MidenMessage) {
        match message {
            MidenMessage::CreateMultisigAccount {
                threshold,
                approvers,
                response,
            } => {
                info!(
                    "🏗️  Processing create multisig account request (threshold: {}, approvers: {})",
                    threshold,
                    approvers.len()
                );

                // TODO: Implement actual miden multisig account creation
                // For now, using a placeholder implementation
                let result =
                    Self::create_multisig_account_impl(client, threshold, &approvers).await;
                let _ = response.send(result);
            }
            MidenMessage::ProcessTransaction {
                tx_data,
                account_id,
                signature,
                response,
            } => {
                info!(
                    "⚙️  Processing transaction for account: {} with {} signatures",
                    account_id,
                    signature.len()
                );

                // TODO: Implement actual miden transaction processing
                // For now, using a placeholder implementation
                let result =
                    Self::process_transaction_impl(client, tx_data, &account_id, &signature).await;
                let _ = response.send(result);
            }
            MidenMessage::Shutdown => {
                // Handled in the main loop
            }
        }
    }

    /// Implementation for creating multisig accounts with real miden client
    async fn create_multisig_account_impl(
        client: &mut Client,
        threshold: u32,
        approvers: &[ApproverInfo],
    ) -> Result<String, String> {
        info!("🔧 [MIDEN] Creating multisig account with real miden client");

        // TODO: Implement actual miden multisig account creation
        // This would involve:
        // 1. Creating a new miden account
        // 2. Setting up multisig authentication with threshold and approvers
        // 3. Deploying the multisig smart contract
        // 4. Returning the account address

        // For now, return a deterministic address based on input
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        threshold.hash(&mut hasher);
        for approver in approvers {
            approver.address.hash(&mut hasher);
            approver.public_key.hash(&mut hasher);
        }

        let hash = hasher.finish();
        let account_address = format!("miden_multisig_real_{:x}", hash);

        println!("\n[STEP 1] Creating a new account for Alice");

        // Account seed
        let mut init_seed = [0_u8; 32];
        client.rng().fill_bytes(&mut init_seed);

        let key_pair = SecretKey::with_rng(client.rng());

        // Build the account
        let builder = AccountBuilder::new(init_seed)
            .account_type(AccountType::RegularAccountUpdatableCode)
            .storage_mode(AccountStorageMode::Public)
            .with_auth_component(RpoFalcon512::new(key_pair.public_key()))
            .with_component(BasicWallet);

        let (alice_account, seed) = builder.build().unwrap();

        // Add the account to the client
        client
            .add_account(&alice_account, Some(seed), false)
            .await?;

        let keystore: FilesystemKeyStore<rand::prelude::StdRng> =
            FilesystemKeyStore::new("./keystore".into()).unwrap();

        // Add the key pair to the keystore
        keystore
            .add_key(&AuthSecretKey::RpoFalcon512(key_pair))
            .unwrap();

        // Ensure keystore directory exists before creating FilesystemKeyStore

        info!("✅ [MIDEN] Multisig account created: {}", account_address);
        Ok(account_address)
    }

    /// Implementation for processing transactions with real miden client
    async fn process_transaction_impl(
        client: &mut Client,
        tx_data: String,
        account_id: &str,
        signatures: &[String],
    ) -> Result<String, String> {
        info!("🔧 [MIDEN] Processing transaction with real miden client");

        // TODO: Implement actual miden transaction processing
        // This would involve:
        // 1. Validating the transaction data
        // 2. Checking signatures against the multisig threshold
        // 3. Submitting the transaction to the miden network
        // 4. Returning the transaction hash

        // For now, return a deterministic hash
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        account_id.hash(&mut hasher);
        for sig in signatures {
            sig.hash(&mut hasher);
        }
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        timestamp.hash(&mut hasher);

        let hash = hasher.finish();
        let tx_hash = format!("tx_hash_real_{:x}", hash);

        // TODO: Implement actual miden transaction processing
        // This would involve:
        // 1. Validating the transaction data
        // 2. Checking signatures against the multisig threshold
        // 3. Submitting the transaction to the miden network
        // 4. Returning the transaction hash

        let bytes = hex_to_bytes(&tx_data).unwrap();
        let account_id = AccountId::from_hex(account_id).unwrap();

        let transaction_request = TransactionRequest::read_from_bytes(&bytes).unwrap();

        let tx_execution_result = client
            .new_transaction(account_id, transaction_request)
            .await?;

        client.submit_transaction(tx_execution_result).await?;
        println!("All of Alice's notes consumed successfully.");

        info!("✅ [MIDEN] Transaction processed: {}", tx_hash);
        Ok(tx_hash)
    }
}

/// Cloneable sender that can be shared across multiple threads/tasks
#[derive(Clone)]
pub struct MidenRuntimeSender {
    pub sender: mpsc::UnboundedSender<MidenMessage>,
}

impl MidenRuntimeSender {
    /// Create a new multisig account via the miden runtime
    pub async fn create_multisig_account(
        &self,
        threshold: u32,
        approvers: Vec<ApproverInfo>,
    ) -> Result<String, String> {
        let (response_tx, response_rx) = oneshot::channel();

        self.sender
            .send(MidenMessage::CreateMultisigAccount {
                threshold,
                approvers,
                response: response_tx,
            })
            .map_err(|_| "Failed to send message to miden runtime".to_string())?;

        tracing::info!("Waiting for response from miden runtime");
        response_rx
            .await
            .inspect(|r| tracing::info!("Received response from miden runtime: {:?}", r))
            .inspect_err(|e| {
                tracing::error!("Error receiving response from miden runtime: {:?}", e)
            })
            .map_err(|_| "Failed to receive response from miden runtime".to_string())?
    }

    /// Process a transaction via the miden runtime
    pub async fn process_transaction(
        &self,
        tx_data: String,
        account_id: String,
        signature: Vec<String>,
    ) -> Result<String, String> {
        let (response_tx, response_rx) = oneshot::channel();

        self.sender
            .send(MidenMessage::ProcessTransaction {
                tx_data,
                account_id,
                signature,
                response: response_tx,
            })
            .map_err(|_| "Failed to send message to miden runtime".to_string())?;

        response_rx
            .await
            .map_err(|_| "Failed to receive response from miden runtime".to_string())?
    }
}
