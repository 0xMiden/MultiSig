mod error;

pub use self::error::MidenRuntimeError;

use std::sync::Arc;

use miden_client::{
	Client, ClientError, DebugMode, Word,
	account::{AccountIdAddress, Address, AddressInterface, NetworkId},
	auth::TransactionAuthenticator,
	builder::ClientBuilder,
	keystore::FilesystemKeyStore,
	note::NoteFile,
	rpc::{Endpoint, TonicRpcClient},
	transaction::{TransactionRequest, TransactionResult},
};
use miden_multisig_client::{MultisigClient, MultisigClientError};
use miden_objects::{
	crypto::{
		dsa::rpo_falcon512::{PublicKey, Signature},
		utils::Deserializable,
	},
	transaction::TransactionSummary,
};
use rand::rngs::StdRng;
use serde::{Deserialize, Serialize};
use tokio::{
	sync::{mpsc, oneshot},
	task,
};

use self::error::Result;

/// Messages that can be sent to the miden client runtime
#[derive(Debug)]
pub enum MidenMessage {
	/// Create a new multisig account using miden client
	CreateMultisigAccount {
		threshold: u32,
		approvers: Vec<ApproverInfo>,
		response: oneshot::Sender<Result<String>>,
	},
	/// Propose send transaction
	ProposeTransaction {
		contract: String,
		tx_bz: String,
		response: oneshot::Sender<Result<TransactionSummary>>,
	},
	/// Process transaction data
	ProcessTransaction {
		tx_bz: String,
		summary: String,
		account_id: String,
		sigs: Vec<Option<Signature>>,
		response: oneshot::Sender<Result<TransactionResult>>,
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
	task_handle: task::JoinHandle<()>,
}

impl MidenRuntime {
	/// Creates and starts a new miden client runtime
	pub fn new(message_receiver: mpsc::UnboundedReceiver<MidenMessage>) -> Self {
		tracing::info!("🚀 Initializing Miden Runtime...");

		// Spawn the dedicated tokio task for miden client
		// Use spawn_local for non-Send futures (miden client is not Send/Sync)
		let task_handle = task::spawn_local(Self::run_miden_runtime(message_receiver));

		tracing::info!("✅ Miden Runtime started successfully");

		Self { task_handle }
	}

	/// Shutdown the miden runtime
	pub async fn shutdown(self) -> Result<(), Box<dyn std::error::Error>> {
		tracing::info!("🛑 Shutting down Miden Runtime...");

		// Wait for the task to complete
		self.task_handle.await?;

		tracing::info!("✅ Miden Runtime shutdown complete");

		Ok(())
	}

	/// Main runtime loop that processes miden client messages
	async fn run_miden_runtime(mut message_receiver: mpsc::UnboundedReceiver<MidenMessage>) {
		tracing::info!("🏃 Starting Miden client runtime loop...");

		// Try to initialize the miden client
		let miden_client_result = Self::create_miden_client().await;

		match miden_client_result {
			Ok(miden_client) => {
				let mut multisig_client = MultisigClient::new(miden_client);

				tracing::info!("✅ Miden client initialized successfully");

				// Process messages in the runtime loop
				while let Some(message) = message_receiver.recv().await {
					match &message {
						MidenMessage::Shutdown => {
							tracing::info!("🛑 Received shutdown signal, stopping runtime");
							break;
						},
						_ => {
							// tracing::info!("Handling miden message: {:?}", message);
							Self::handle_miden_message(&mut multisig_client, message).await;
						},
					}
				}
			},
			Err(e) => {
				tracing::info!("❌ Failed to initialize miden client: {}", e);
				tracing::info!(
					"🔄 Running in fallback mode - operations will return mock responses"
				);
			},
		}

		tracing::info!("🏁 Miden client runtime stopped");
	}

	/// Create miden client - this runs entirely within the spawned task
	async fn create_miden_client() -> Result<Client<FilesystemKeyStore<StdRng>>, MidenRuntimeError>
	{
		tracing::info!("🔧 Initializing miden client...");

		// Initialize client & keystore
		let endpoint = Endpoint::testnet();
		let timeout_ms = 10_000;
		let rpc_api = Arc::new(TonicRpcClient::new(&endpoint, timeout_ms));

		ClientBuilder::new()
			.rpc(rpc_api)
			.filesystem_keystore("./keystore")
			.in_debug_mode(DebugMode::Enabled)
			.build()
			.await
			.map_err(MultisigClientError::from)
			.map_err(From::from)
	}

	/// Handle individual miden client messages using real miden client
	async fn handle_miden_message<AUTH>(client: &mut MultisigClient<AUTH>, message: MidenMessage)
	where
		AUTH: TransactionAuthenticator + Sync + 'static,
	{
		match message {
			MidenMessage::CreateMultisigAccount { threshold, approvers, response } => {
				tracing::info!(
					"🏗️  Processing create multisig account request (threshold: {}, approvers: {})",
					threshold,
					approvers.len()
				);

				// TODO: Implement actual miden multisig account creation
				// For now, using a placeholder implementation
				let result =
					Self::create_multisig_account_impl(client, threshold, &approvers).await;
				let _ = response.send(result);
			},
			MidenMessage::ProposeTransaction { contract, tx_bz, response } => {
				tracing::info!("⚙️  Proposing transaction from contract {contract}");

				let result = Self::propose_transaction_impl(client, &contract, &tx_bz).await;

				let _ = response.send(result);
			},
			MidenMessage::ProcessTransaction {
				tx_bz: tx_data,
				summary,
				account_id,
				sigs,
				response,
			} => {
				tracing::info!("⚙️  Processing transaction for account: {account_id}");

				let result =
					Self::process_transaction_impl(client, tx_data, summary, &account_id, &sigs)
						.await;

				let _ = response.send(result);
			},
			MidenMessage::Shutdown => {
				// Handled in the main loop
			},
		}
	}

	/// Implementation for creating multisig accounts with real miden client
	async fn create_multisig_account_impl<AUTH>(
		client: &mut MultisigClient<AUTH>,
		threshold: u32,
		approvers: &[ApproverInfo],
	) -> Result<String>
	where
		AUTH: TransactionAuthenticator + Sync + 'static,
	{
		tracing::info!("🔧 [MIDEN] Creating multisig account with real miden client");

		let approvers = approvers
			.iter()
			.map(|ApproverInfo { public_key, .. }| {
				const_hex::decode(public_key)
					.map_err(|e| MidenRuntimeError::Other(e.to_string().into()))
					.and_then(|bz| {
						Word::read_from_bytes(&bz)
							.map_err(|e| MidenRuntimeError::Other(e.to_string().into()))
					})
			})
			.map(|word| word.map(PublicKey::new))
			.collect::<Result<_, _>>()?;

		let account = client.setup_account(approvers, threshold).await?;

		client.sync_state().await.map_err(MultisigClientError::from)?;

		let bech32 = {
			let acc_id_addr = AccountIdAddress::new(account.id(), AddressInterface::BasicWallet);
			Address::AccountId(acc_id_addr).to_bech32(NetworkId::Testnet)
		};

		tracing::info!("✅ [MIDEN] Multisig account created: {bech32}");

		Ok(bech32)
	}

	async fn propose_transaction_impl<AUTH>(
		client: &mut MultisigClient<AUTH>,
		contract: &str,
		tx_bz: &str,
	) -> Result<TransactionSummary>
	where
		AUTH: TransactionAuthenticator + Sync + 'static,
	{
		let multisig_account_id = {
			let (_, Address::AccountId(addr)) = Address::from_bech32(contract)
				.map_err(|e| MidenRuntimeError::Other(e.to_string().into()))?
			else {
				return Err(MidenRuntimeError::Other("invalid account".into()));
			};

			addr.id()
		};

		let tx_request = const_hex::decode(tx_bz)
			.map_err(|e| MidenRuntimeError::Other(e.to_string().into()))
			.map(|bz| TransactionRequest::read_from_bytes(&bz))?
			.map_err(|e| MidenRuntimeError::Other(e.to_string().into()))?;

		for nid in tx_request.get_input_note_ids() {
			client.import_note(NoteFile::NoteId(nid)).await.map_err(MultisigClientError::from)?;
			client.sync_state().await.map_err(MultisigClientError::from)?;
		}

		tracing::info!("generating summary");

		let tx_summary = client
			.propose_multisig_transaction(multisig_account_id, tx_request)
			.await
			.inspect_err(|e| tracing::error!("propose multisig tx error: {e}"))
			.inspect_err(|e| {
				if let MultisigClientError::Client(ClientError::TransactionRequestError(re)) = e {
					tracing::error!("transaction req error: {re}");
				} else if let MultisigClientError::Client(ClientError::AssetError(ae)) = e {
					tracing::error!("transaction req asset error: {ae}");
				}
			})?;

		tracing::info!("generated summary");

		Ok(tx_summary)
	}

	/// Implementation for processing transactions with real miden client
	async fn process_transaction_impl<AUTH>(
		client: &mut MultisigClient<AUTH>,
		tx_bz: String,
		summary: String,
		account_id: &str,
		sigs: &[Option<Signature>],
	) -> Result<TransactionResult>
	where
		AUTH: TransactionAuthenticator + Sync + 'static,
	{
		tracing::info!("🔧 [MIDEN] Processing transaction with real miden client");

		let tx_request = {
			let bz = const_hex::decode(tx_bz)
				.map_err(|e| e.to_string())
				.map_err(|e| MidenRuntimeError::Other(e.into()))
				.inspect_err(|e| tracing::error!("tx request bz error: {e}"))?;

			TransactionRequest::read_from_bytes(&bz)
				.map_err(|e| e.to_string())
				.map_err(|e| MidenRuntimeError::Other(e.into()))
				.inspect_err(|e| tracing::error!("tx request deserialize error: {e}"))?
		};

		let tx_summary = {
			let bz = const_hex::decode(summary)
				.map_err(|e| e.to_string())
				.map_err(|e| MidenRuntimeError::Other(e.into()))
				.inspect_err(|e| tracing::error!("tx summary decode error: {e}"))?;

			TransactionSummary::read_from_bytes(&bz)
				.map_err(|e| e.to_string())
				.map_err(|e| MidenRuntimeError::Other(e.into()))
				.inspect_err(|e| tracing::error!("tx summary deserialize error: {e}"))?
		};

		let account_id = {
			let (_, Address::AccountId(acc_id_addr)) = Address::from_bech32(account_id)
				.map_err(|e| e.to_string())
				.map_err(|e| MidenRuntimeError::Other(e.into()))
				.inspect_err(|e| tracing::error!("address from bech32 error: {e}"))?
			else {
				return Err(MidenRuntimeError::Other("invalid acc id".into()));
			};

			acc_id_addr.id()
		};

		client.sync_state().await.map_err(MultisigClientError::from)?;

		let account =
			client.try_get_account(account_id).await.map_err(MultisigClientError::from)?;

		let sigs = sigs
			.iter()
			.map(|s| s.clone().map(miden_falcon_sign_test::turn_sig_into_felt_vec))
			.collect();

		let tx_result = client
			.new_multisig_transaction(account.account(), tx_request, tx_summary, sigs)
			.await
			.inspect_err(|e| tracing::error!("new multisig tx error: {e:?}"))?;

		// let tx_execution_result = client.new_transaction(account_id, transaction_request).await?;

		// client.submit_transaction(tx_execution_result).await?;
		// println!("All of Alice's notes consumed successfully.");

		client
			.submit_transaction(tx_result.clone())
			.await
			.map_err(MultisigClientError::from)
			.inspect_err(|e| tracing::error!("submit tx error: {e}"))?;

		// tracing::info!("✅ [MIDEN] Transaction processed: {tx_result:?}");
		Ok(tx_result)
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
	) -> Result<String> {
		let (response_tx, response_rx) = oneshot::channel();

		self.sender
			.send(MidenMessage::CreateMultisigAccount {
				threshold,
				approvers,
				response: response_tx,
			})
			.map_err(|_| "Failed to send message to miden runtime")
			.map_err(|e| MidenRuntimeError::Other(e.into()))?;

		tracing::info!("Waiting for response from miden runtime");
		response_rx
			.await
			.inspect(|r| tracing::info!("Received response from miden runtime: {:?}", r))
			.inspect_err(|e| {
				tracing::error!("Error receiving response from miden runtime: {:?}", e)
			})
			.map_err(|_| "Failed to receive response from miden runtime")
			.map_err(|e| MidenRuntimeError::Other(e.into()))?
	}

	pub async fn propose_transaction(
		&self,
		contract: String,
		tx_bz: String,
	) -> Result<TransactionSummary> {
		let (resp_tx, resp_rx) = oneshot::channel();

		self.sender
			.send(MidenMessage::ProposeTransaction { contract, tx_bz, response: resp_tx })
			.map_err(|e| format!("failed to send msg to miden runtime: {e}"))
			.map_err(|e| MidenRuntimeError::Other(e.into()))?;

		resp_rx
			.await
			.map_err(|e| format!("failed to receive response from miden runtime: {e}"))
			.map_err(|e| MidenRuntimeError::Other(e.into()))?
	}

	/// Process a transaction via the miden runtime
	pub async fn process_transaction(
		&self,
		tx_bz: String,
		summary: String,
		account_id: String,
		sigs: Vec<Option<Signature>>,
	) -> Result<TransactionResult> {
		let (response_tx, response_rx) = oneshot::channel();

		self.sender
			.send(MidenMessage::ProcessTransaction {
				tx_bz,
				summary,
				account_id,
				sigs,
				response: response_tx,
			})
			.map_err(|_| "Failed to send message to miden runtime")
			.map_err(|e| MidenRuntimeError::Other(e.into()))?;

		response_rx
			.await
			.map_err(|_| "Failed to receive response from miden runtime")
			.map_err(|e| MidenRuntimeError::Other(e.into()))?
	}
}

#[cfg(test)]
mod tests {
	use std::{thread, time::Duration};

	use miden_client::{
		Felt,
		account::{
			AccountBuilder, AccountStorageMode, AccountType,
			component::{AuthRpoFalcon512, BasicFungibleFaucet, BasicWallet},
		},
		asset::{FungibleAsset, TokenSymbol},
		auth::AuthSecretKey,
		crypto::SecretKey,
		note::{Note, NoteType},
		transaction::{PaymentNoteDescription, TransactionRequestBuilder},
	};
	use miden_tx::utils::Serializable;
	use rand::RngCore;
	use tokio::{runtime::Runtime, task::LocalSet};

	use super::*;

	#[tokio::test]
	async fn miden_runtime_works() {
		tracing_subscriber::fmt::init();

		let (message_sender, message_receiver) = mpsc::unbounded_channel::<MidenMessage>();

		let runtime_handle = thread::spawn(|| {
			let local = LocalSet::new();

			let local_runtime = local.run_until(async {
				let runtime = MidenRuntime::new(message_receiver);
				runtime.shutdown().await.unwrap();
			});

			let rt = Runtime::new().unwrap();

			rt.block_on(local_runtime);
		});

		let miden_sender = MidenRuntimeSender { sender: message_sender };

		println!("begin");

		let endpoint = Endpoint::testnet();
		let timeout_ms = 10_000;
		let rpc_api = Arc::new(TonicRpcClient::new(&endpoint, timeout_ms));

		let keystore: FilesystemKeyStore<rand::prelude::StdRng> =
			FilesystemKeyStore::new("./workstest/keystore".into()).unwrap();

		let mut client: Client<FilesystemKeyStore<StdRng>> = ClientBuilder::new()
			.sqlite_store("./workstest/store.sqlite3")
			.rpc(rpc_api)
			.authenticator(keystore.clone().into())
			.in_debug_mode(DebugMode::Enabled)
			.build()
			.await
			.unwrap();

		client.sync_state().await.unwrap();

		// Faucet seed
		let mut init_seed = [0u8; 32];
		client.rng().fill_bytes(&mut init_seed);

		// Faucet parameters
		let symbol = TokenSymbol::new("MID").unwrap();
		let decimals = 8;
		let max_supply = Felt::new(1_000_000);

		// Generate key pair
		let key_pair = SecretKey::with_rng(client.rng());

		// Build the account
		let builder = AccountBuilder::new(init_seed)
			.account_type(AccountType::FungibleFaucet)
			.storage_mode(AccountStorageMode::Public)
			.with_auth_component(AuthRpoFalcon512::new(key_pair.public_key()))
			.with_component(BasicFungibleFaucet::new(symbol, decimals, max_supply).unwrap());

		let (faucet_account, seed) = builder.build().unwrap();

		// Add the faucet to the client
		client.add_account(&faucet_account, Some(seed), false).await.unwrap();

		// Add the key pair to the keystore
		keystore.add_key(&AuthSecretKey::RpoFalcon512(key_pair)).unwrap();

		// Resync to show newly deployed faucet
		client.sync_state().await.unwrap();
		tokio::time::sleep(Duration::from_secs(5)).await;

		// account 1

		// Account seed
		let mut init_seed = [0_u8; 32];
		client.rng().fill_bytes(&mut init_seed);

		let alice_sk = SecretKey::with_rng(client.rng());

		// Build the account
		let builder = AccountBuilder::new(init_seed)
			.account_type(AccountType::RegularAccountUpdatableCode)
			.storage_mode(AccountStorageMode::Public)
			.with_auth_component(AuthRpoFalcon512::new(alice_sk.public_key()))
			.with_component(BasicWallet);

		let (alice_account, alice_seed) = builder.build().unwrap();

		// Add the account to the client
		client.add_account(&alice_account, Some(alice_seed), false).await.unwrap();

		// Add the key pair to the keystore
		keystore.add_key(&AuthSecretKey::RpoFalcon512(alice_sk.clone())).unwrap();

		client.sync_state().await.unwrap();

		println!(
			"alice pub key = {}",
			Word::from(alice_sk.public_key()).to_hex()
		);

		// account 2

		// Account seed
		let mut init_seed = [0_u8; 32];
		client.rng().fill_bytes(&mut init_seed);

		let bob_sk = SecretKey::with_rng(client.rng());

		// Build the account
		let builder = AccountBuilder::new(init_seed)
			.account_type(AccountType::RegularAccountUpdatableCode)
			.storage_mode(AccountStorageMode::Public)
			.with_auth_component(AuthRpoFalcon512::new(bob_sk.public_key()))
			.with_component(BasicWallet);

		let (bob_account, bob_seed) = builder.build().unwrap();

		// Add the account to the client
		client.add_account(&bob_account, Some(bob_seed), false).await.unwrap();

		// Add the key pair to the keystore
		keystore.add_key(&AuthSecretKey::RpoFalcon512(bob_sk.clone())).unwrap();

		client.sync_state().await.unwrap();

		println!("bob pub key = {}", Word::from(bob_sk.public_key()).to_hex());

		let approver_info_vec = {
			let alice_pk_hex = const_hex::encode(Word::from(alice_sk.public_key()).to_bytes());

			let bob_pk_hex = const_hex::encode(Word::from(bob_sk.public_key()).to_bytes());

			let alice_bech32 = Address::AccountId(AccountIdAddress::new(
				alice_account.id(),
				AddressInterface::BasicWallet,
			))
			.to_bech32(NetworkId::Testnet);
			let bob_bech32 = Address::AccountId(AccountIdAddress::new(
				bob_account.id(),
				AddressInterface::BasicWallet,
			))
			.to_bech32(NetworkId::Testnet);

			vec![
				ApproverInfo { public_key: alice_pk_hex, address: alice_bech32 },
				ApproverInfo { public_key: bob_pk_hex, address: bob_bech32 },
			]
		};

		println!("approver info = {approver_info_vec:?}");

		let multisig_bech32 =
			miden_sender.create_multisig_account(1, approver_info_vec).await.unwrap();

		let (_, Address::AccountId(multisig_acc_id_addr)) =
			Address::from_bech32(&multisig_bech32).unwrap()
		else {
			panic!("invalid address");
		};

		let mint_request = {
			let asset = FungibleAsset::new(faucet_account.id(), 115).unwrap();
			TransactionRequestBuilder::new()
				.build_mint_fungible_asset(
					asset,
					multisig_acc_id_addr.id(),
					NoteType::Public,
					client.rng(),
				)
				.unwrap()
		};

		let mint_note_ids: Vec<_> = mint_request
			.expected_output_own_notes()
			.iter()
			.inspect(|&n| println!("mint note id = {}", n.id()))
			.map(Note::id)
			.collect();

		let tx_result = client.new_transaction(faucet_account.id(), mint_request).await.unwrap();

		client.submit_transaction(tx_result).await.unwrap();
		client.sync_state().await.unwrap();
		tokio::time::sleep(Duration::from_secs(10)).await;

		client.sync_state().await.unwrap();

		let receive_tx_request = {
			for &nid in &mint_note_ids {
				println!(
					"note id = {nid}, note = {:?}",
					client.get_input_note(nid).await.unwrap()
				);
			}

			TransactionRequestBuilder::new().build_consume_notes(mint_note_ids).unwrap()
		};

		let receive_tx_request_hex = const_hex::encode(receive_tx_request.to_bytes());

		let tx_summary = miden_sender
			.propose_transaction(multisig_bech32.clone(), receive_tx_request_hex.clone())
			.await
			.unwrap();

		let tx_summary_commitment = tx_summary.to_commitment();

		let tx_summary_hex = const_hex::encode(tx_summary.to_bytes());

		let alice_sig = alice_sk.sign(tx_summary_commitment);

		let tx_result = miden_sender
			.process_transaction(
				receive_tx_request_hex,
				tx_summary_hex,
				multisig_bech32.clone(),
				vec![Some(alice_sig), None],
			)
			.await
			.unwrap();

		// client.submit_transaction(tx_result).await.unwrap();

		client.sync_state().await.unwrap();

		tokio::time::sleep(Duration::from_secs(5)).await;

		// account 3

		// Account seed
		let mut init_seed = [0_u8; 32];
		client.rng().fill_bytes(&mut init_seed);

		let charlie_sk = SecretKey::with_rng(client.rng());

		// Build the account
		let builder = AccountBuilder::new(init_seed)
			.account_type(AccountType::RegularAccountUpdatableCode)
			.storage_mode(AccountStorageMode::Public)
			.with_auth_component(AuthRpoFalcon512::new(charlie_sk.public_key()))
			.with_component(BasicWallet);

		let (charlie_account, charlie_seed) = builder.build().unwrap();

		// Add the account to the client
		client.add_account(&charlie_account, Some(charlie_seed), false).await.unwrap();

		// Add the key pair to the keystore
		keystore.add_key(&AuthSecretKey::RpoFalcon512(charlie_sk.clone())).unwrap();

		client.sync_state().await.unwrap();

		println!(
			"charlie pub key = {}",
			Word::from(charlie_sk.public_key()).to_hex()
		);

		let charlie_send_request = {
			let asset = FungibleAsset::new(faucet_account.id(), 17).unwrap();

			let description = PaymentNoteDescription::new(
				vec![asset.into()],
				multisig_acc_id_addr.id(),
				charlie_account.id(),
			);

			TransactionRequestBuilder::new()
				.build_pay_to_id(description, NoteType::Public, client.rng())
				.unwrap()
		};

		let charlie_send_request_hex = const_hex::encode(charlie_send_request.to_bytes());

		let tx_summary = miden_sender
			.propose_transaction(multisig_bech32.clone(), charlie_send_request_hex.clone())
			.await
			.unwrap();

		let tx_summary_commitment = tx_summary.to_commitment();

		let tx_summary_hex = const_hex::encode(tx_summary.to_bytes());

		let bob_sig = bob_sk.sign(tx_summary_commitment);

		tracing::info!("process charlie send request");

		let tx_result = miden_sender
			.process_transaction(
				charlie_send_request_hex,
				tx_summary_hex,
				multisig_bech32.clone(),
				vec![None, Some(bob_sig)],
			)
			.await
			.unwrap();

		// client.submit_transaction(tx_result).await.unwrap();

		tokio::time::sleep(Duration::from_secs(5)).await;

		client.sync_state().await.unwrap();

		client.sync_state().await.unwrap();

		let consumable_notes =
			client.get_consumable_notes(Some(charlie_account.id())).await.unwrap();

		let nids = consumable_notes.iter().map(|(note, _)| note.id()).collect();

		let charlie_receive_request =
			TransactionRequestBuilder::new().build_consume_notes(nids).unwrap();

		client.sync_state().await.unwrap();

		let tx_result =
			client.new_transaction(charlie_account.id(), charlie_receive_request).await.unwrap();

		client.submit_transaction(tx_result).await.unwrap();

		tokio::time::sleep(Duration::from_secs(10)).await;

		client.sync_state().await.unwrap();

		println!("faucet = {}", faucet_account.id());
		println!("alice = {}", alice_account.id());
		println!("bob = {}", bob_account.id());
		println!("charlie = {}", charlie_account.id());
		println!("multisig = {}", multisig_acc_id_addr.id());

		let faucet_bech32 = Address::AccountId(AccountIdAddress::new(
			faucet_account.id(),
			AddressInterface::BasicWallet,
		))
		.to_bech32(NetworkId::Testnet);

		let alice_bech32 = Address::AccountId(AccountIdAddress::new(
			alice_account.id(),
			AddressInterface::BasicWallet,
		))
		.to_bech32(NetworkId::Testnet);

		let bob_bech32 = Address::AccountId(AccountIdAddress::new(
			bob_account.id(),
			AddressInterface::BasicWallet,
		))
		.to_bech32(NetworkId::Testnet);

		let charlie_bech32 = Address::AccountId(AccountIdAddress::new(
			charlie_account.id(),
			AddressInterface::BasicWallet,
		))
		.to_bech32(NetworkId::Testnet);

		println!("faucet bech32 = {}", faucet_bech32);
		println!("alice bech32 = {}", alice_bech32);
		println!("bob bech32 = {}", bob_bech32);
		println!("charlie bech32 = {}", charlie_bech32);
		println!("multisig bech32 = {}", multisig_bech32);

		tokio::time::sleep(Duration::from_secs(30)).await;

		// runtime_handle.join().unwrap();
	}
}
