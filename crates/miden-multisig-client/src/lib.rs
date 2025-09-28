//! A client for managing multisig transactions.
#[macro_use]
extern crate alloc;

use alloc::string::ToString;
use alloc::vec::Vec;
use anyhow::Context;
use core::ops::{Deref, DerefMut};
use rand::RngCore;
use rand::rngs::StdRng;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use url::Url;

use miden_client::ClientError;
use miden_client::account::AccountFile;
use miden_client::account::component::{AuthRpoFalcon512Multisig, BasicWallet};
use miden_client::account::{Account, AccountBuilder, AccountId, AccountStorageMode, AccountType};
use miden_client::auth::TransactionAuthenticator;
use miden_client::builder::ClientBuilder;
use miden_client::keystore::FilesystemKeyStore;
use miden_client::rpc::Endpoint;
use miden_client::transaction::TransactionExecutorError;
use miden_client::{Felt, Word, ZERO};
use miden_objects::Hasher;
use miden_objects::assembly::diagnostics::tracing::info;
use miden_objects::crypto::dsa::rpo_falcon512::PublicKey;
use miden_objects::transaction::TransactionSummary;

use miden_client::Client;
use miden_client::transaction::{TransactionRequest, TransactionResult};

#[cfg(test)]
mod tests;

/// Represents errors that can occur in the multisig client.
#[derive(Debug, Error)]
pub enum MultisigClientError {
	#[error("multisig transaction proposal error: {0}")]
	/// An error occurred while proposing a new transaction.
	TxProposalError(String),
	#[error("multisig transaction execution error: {0}")]
	/// An error occurred while executing a transaction.
	TxExecutionError(String),
}

/// A client for interacting with Miden multisig accounts.
pub struct MultisigClient<AUTH: TransactionAuthenticator + Sync + 'static> {
	client: Client<AUTH>,
}

impl MultisigClient<FilesystemKeyStore<StdRng>> {
	/// Loads the multisig client.
	///
	/// A client is instantiated with the provided store path, node url and timeout. The account is
	/// loaded from the provided account file. If the account is already tracked by the current
	/// store, it is loaded. Otherwise, the account is added from the file state.
	///
	/// If a remote transaction prover url is provided, it is used to prove transactions. Otherwise,
	/// a local transaction prover is used.
	pub async fn load(
		store_path: PathBuf,
		account_files: Vec<AccountFile>,
		node_url: &Url,
		timeout: Duration,
	) -> anyhow::Result<Self> {
		let keystore = FilesystemKeyStore::<StdRng>::new(PathBuf::from("keystore"))
			.context("failed to create keystore")?;
		for key in account_files.iter().flat_map(|f| f.auth_secret_keys.iter()) {
			keystore.add_key(key)?;
		}
		let url: &str = node_url.as_str().trim_end_matches('/');
		let endpoint = Endpoint::try_from(url)
			.map_err(anyhow::Error::msg)
			.with_context(|| format!("failed to parse node url: {node_url}"))?;

		let mut client = ClientBuilder::new()
			.tonic_rpc_client(&endpoint, Some(timeout.as_millis() as u64))
			.authenticator(Arc::new(keystore))
			.sqlite_store(store_path.to_str().context("invalid store path")?)
			.build()
			.await?;

		info!("Fetching faucet state from node");

		client.ensure_genesis_in_place().await?;

		Ok(Self { client })
	}
}

impl<AUTH: TransactionAuthenticator + Sync + 'static> Deref for MultisigClient<AUTH> {
	type Target = Client<AUTH>;

	fn deref(&self) -> &Self::Target {
		&self.client
	}
}

impl<AUTH: TransactionAuthenticator + Sync + 'static> DerefMut for MultisigClient<AUTH> {
	fn deref_mut(&mut self) -> &mut Self::Target {
		&mut self.client
	}
}

impl<AUTH: TransactionAuthenticator + Sync + 'static> MultisigClient<AUTH> {
	/// Sets up a new multisig account with the specified approvers and threshold.
	pub async fn setup_account(&mut self, approvers: Vec<PublicKey>, threshold: u32) -> Account {
		let mut init_seed = [0u8; 32];
		self.rng().fill_bytes(&mut init_seed);

		let multisig_auth_component = AuthRpoFalcon512Multisig::new(threshold, approvers).unwrap();
		let (multisig_account, seed) = AccountBuilder::new(init_seed)
			.with_auth_component(multisig_auth_component)
			.account_type(AccountType::RegularAccountImmutableCode)
			.storage_mode(AccountStorageMode::Public)
			.with_component(BasicWallet)
			.build()
			.unwrap();

		self.add_account(&multisig_account, Some(seed), false).await.unwrap();

		multisig_account
	}
}

impl<AUTH: TransactionAuthenticator + Sync + 'static> MultisigClient<AUTH> {
	/// Propose a multisig transaction. This is expected to "dry-run" and only return
	/// `TransactionSummary`.
	pub async fn propose_multisig_transaction(
		&mut self,
		account_id: AccountId,
		transaction_request: TransactionRequest,
	) -> Result<TransactionSummary, MultisigClientError> {
		let tx_result = self.new_transaction(account_id, transaction_request).await;

		match tx_result {
			Ok(_) => Err(MultisigClientError::TxProposalError(
				"expecting a dry run, but tx was executed".to_string(),
			)),
			// otherwise match on Unauthorized
			Err(ClientError::TransactionExecutorError(TransactionExecutorError::Unauthorized(
				summary,
			))) => Ok(*summary),
			Err(e) => Err(MultisigClientError::TxProposalError(e.to_string())),
		}
	}

	/// Creates and executes a transaction specified by the request against the specified multisig
	/// account. It is expected to have at least `threshold` signatures from the approvers.
	pub async fn new_multisig_transaction(
		&mut self,
		account: Account,
		mut transaction_request: TransactionRequest,
		transaction_summary: TransactionSummary,
		signatures: Vec<Option<Vec<Felt>>>,
	) -> Result<TransactionResult, MultisigClientError> {
		// Add signatures to the advice provider
		let advice_inputs = transaction_request.advice_map_mut();
		let msg = transaction_summary.to_commitment();
		let num_approvers: u32 =
			account.storage().get_item(0).unwrap().as_elements()[1].try_into().unwrap();

		for i in 0..num_approvers as usize {
			let pub_key_index_word = Word::from([Felt::from(i as u32), ZERO, ZERO, ZERO]);
			let pub_key = account.storage().get_map_item(1, pub_key_index_word).unwrap();
			let sig_key = Hasher::merge(&[pub_key, msg]);
			if let Some(signature) = signatures.get(i).and_then(|s| s.as_ref()) {
				advice_inputs.extend(vec![(sig_key, signature.clone())]);
			}
		}

		// TODO as sanity check we should verify that we have enough signatures

		self.new_transaction(account.id(), transaction_request)
			.await
			.map_err(|e| MultisigClientError::TxExecutionError(e.to_string()))
	}
}
