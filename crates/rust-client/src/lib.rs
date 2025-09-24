// #![no_std]

extern crate alloc;

mod error;

pub use self::error::MultisigClientError;

use core::ops::{Deref, DerefMut};

use alloc::vec::Vec;
use miden_client::{
	Client, ClientError, Felt, Word, ZERO,
	account::{
		Account, AccountBuilder, AccountId, AccountStorageMode, AccountType, component::BasicWallet,
	},
	auth::TransactionAuthenticator,
	transaction::{TransactionExecutorError, TransactionRequest, TransactionResult},
};
use miden_lib::account::auth::AuthRpoFalcon512Multisig;
use miden_objects::{
	Hasher, crypto::dsa::rpo_falcon512::PublicKey, transaction::TransactionSummary,
};
use rand::RngCore;

use self::error::Result;

pub struct MultisigClient<AUTH> {
	client: Client<AUTH>,
}

impl<AUTH> MultisigClient<AUTH> {
	pub fn new(client: Client<AUTH>) -> Self {
		Self { client }
	}
}

impl<AUTH> MultisigClient<AUTH>
where
	AUTH: TransactionAuthenticator,
{
	pub async fn setup_account(
		&mut self,
		approvers: Vec<PublicKey>,
		threshold: u32,
	) -> Result<Account> {
		let mut init_seed = [0u8; 32];
		self.rng().fill_bytes(&mut init_seed);

		let multisig_auth_component =
			AuthRpoFalcon512Multisig::new(threshold, approvers).map_err(ClientError::from)?;

		let (multisig_account, seed) = AccountBuilder::new(init_seed)
			.with_auth_component(multisig_auth_component)
			.account_type(AccountType::RegularAccountImmutableCode)
			.storage_mode(AccountStorageMode::Public)
			.with_component(BasicWallet)
			.build()
			.unwrap();

		self.add_account(&multisig_account, Some(seed), false).await?;

		Ok(multisig_account)
	}

	pub async fn propose_multisig_transaction(
		&mut self,
		account_id: AccountId,
		transaction_request: TransactionRequest,
	) -> Result<TransactionSummary>
	where
		AUTH: Sync + 'static,
	{
		match self.new_transaction(account_id, transaction_request).await {
			Ok(_) => Err(MultisigClientError::MultisigTxProposalError(
				"dry run expected, but tx got executed".into(),
			)),
			Err(ClientError::TransactionExecutorError(TransactionExecutorError::Unauthorized(
				summary,
			))) => Ok(*summary),
			Err(e) => Err(e.into()),
		}
	}

	pub async fn new_multisig_transaction(
		&mut self,
		account: &Account,
		mut transaction_request: TransactionRequest,
		transaction_summary: TransactionSummary,
		signatures: Vec<Option<Vec<Felt>>>,
	) -> Result<TransactionResult, MultisigClientError>
	where
		AUTH: Sync + 'static,
	{
		let msg = transaction_summary.to_commitment();
		let num_approvers: u32 =
			account.storage().get_item(0).map_err(ClientError::from)?.as_elements()[1]
				.try_into()
				.unwrap();

		let advice_inputs_iter = (0..num_approvers).flat_map(|i| {
			let pub_key_index_word = Word::from([Felt::from(i), ZERO, ZERO, ZERO]);
			let pub_key = account.storage().get_map_item(1, pub_key_index_word).unwrap();
			let sig_key = Hasher::merge(&[pub_key, msg]);

			signatures.get(i as usize).and_then(|s| s.as_ref().map(|s| (sig_key, s.clone())))
		});

		transaction_request.advice_map_mut().extend(advice_inputs_iter);

		self.new_transaction(account.id(), transaction_request).await.map_err(From::from)
	}
}

impl<AUTH> Deref for MultisigClient<AUTH> {
	type Target = Client<AUTH>;

	fn deref(&self) -> &Self::Target {
		&self.client
	}
}

impl<AUTH> DerefMut for MultisigClient<AUTH> {
	fn deref_mut(&mut self) -> &mut Self::Target {
		&mut self.client
	}
}

#[cfg(test)]
mod tests {
	use core::time::Duration;

	use alloc::sync::Arc;
	use miden_client::{
		Client, DebugMode, Felt,
		account::{
			AccountBuilder, AccountIdAddress, AccountStorageMode, AccountType, Address,
			AddressInterface,
		},
		asset::{FungibleAsset, TokenSymbol},
		auth::AuthSecretKey,
		builder::ClientBuilder,
		crypto::SecretKey,
		keystore::FilesystemKeyStore,
		note::{Note, NoteFile, NoteType},
		rpc::{Endpoint, TonicRpcClient},
		transaction::{PaymentNoteDescription, TransactionRequestBuilder},
	};
	use miden_lib::account::{
		auth::AuthRpoFalcon512, faucets::BasicFungibleFaucet, wallets::BasicWallet,
	};
	use rand::{RngCore, rngs::StdRng};

	use crate::MultisigClient;

	#[tokio::test]
	async fn multisig_works() {
		let endpoint = Endpoint::testnet();
		let timeout_ms = 10_000;
		let rpc_api = Arc::new(TonicRpcClient::new(&endpoint, timeout_ms));

		let keystore: FilesystemKeyStore<rand::prelude::StdRng> =
			FilesystemKeyStore::new("./keystore".into()).unwrap();

		let mut client_one: Client<FilesystemKeyStore<StdRng>> = ClientBuilder::new()
			.rpc(rpc_api)
			.authenticator(keystore.clone().into())
			.in_debug_mode(DebugMode::Enabled)
			.build()
			.await
			.unwrap();

		client_one.sync_state().await.unwrap();

		// Faucet seed
		let mut init_seed = [0u8; 32];
		client_one.rng().fill_bytes(&mut init_seed);

		// Faucet parameters
		let symbol = TokenSymbol::new("MID").unwrap();
		let decimals = 8;
		let max_supply = Felt::new(1_000_000);

		// Generate key pair
		let key_pair = SecretKey::with_rng(client_one.rng());

		// Build the account
		let builder = AccountBuilder::new(init_seed)
			.account_type(AccountType::FungibleFaucet)
			.storage_mode(AccountStorageMode::Public)
			.with_auth_component(AuthRpoFalcon512::new(key_pair.public_key()))
			.with_component(BasicFungibleFaucet::new(symbol, decimals, max_supply).unwrap());

		let (faucet_account, seed) = builder.build().unwrap();

		// Add the faucet to the client
		client_one.add_account(&faucet_account, Some(seed), false).await.unwrap();

		// Add the key pair to the keystore
		keystore.add_key(&AuthSecretKey::RpoFalcon512(key_pair)).unwrap();

		// Resync to show newly deployed faucet
		client_one.sync_state().await.unwrap();
		tokio::time::sleep(Duration::from_secs(2)).await;

		println!("faucet = {}", faucet_account.id());

		// let mint_request = {
		// 	let asset = FungibleAsset::new(faucet_account.id(), 100).unwrap();

		// 	let (_, Address::AccountId(acc)) =
		// 		Address::from_bech32("mtst1qzahm202x3jy7qr7dzpa30fvqfcqz9ht2y7").unwrap()
		// 	else {
		// 		panic!("invalid account");
		// 	};

		// 	println!("account id = {}", acc.id());

		// 	let addr = AccountIdAddress::new(acc.id(), AddressInterface::BasicWallet);

		// 	println!(
		// 		"account bech32 = {}",
		// 		Address::AccountId(addr).to_bech32(miden_client::account::NetworkId::Testnet),
		// 	);

		// 	TransactionRequestBuilder::new()
		// 		.build_mint_fungible_asset(asset, acc.id(), NoteType::Public, client_one.rng())
		// 		.unwrap()
		// };

		// for note in mint_request.expected_output_own_notes() {
		// 	println!("note id = {}", note.id());
		// }

		// let tx_result =
		// 	client_one.new_transaction(faucet_account.id(), mint_request).await.unwrap();

		// client_one.submit_transaction(tx_result).await.unwrap();
		// client_one.sync_state().await.unwrap();
		// tokio::time::sleep(Duration::from_secs(10)).await;

		let endpoint = Endpoint::testnet();
		let timeout_ms = 10_000;
		let rpc_api = Arc::new(TonicRpcClient::new(&endpoint, timeout_ms));

		let keystore: FilesystemKeyStore<rand::prelude::StdRng> =
			FilesystemKeyStore::new("./multisig_works/keystore".into()).unwrap();

		let mut client_two: Client<FilesystemKeyStore<StdRng>> = ClientBuilder::new()
			.sqlite_store("./multisig_works/store.sqlite3")
			.rpc(rpc_api)
			.authenticator(keystore.clone().into())
			.in_debug_mode(DebugMode::Enabled)
			.build()
			.await
			.unwrap();

		// account 1

		// Account seed
		let mut init_seed = [0_u8; 32];
		client_two.rng().fill_bytes(&mut init_seed);

		let alice_sk = SecretKey::with_rng(client_two.rng());

		// Build the account
		let builder = AccountBuilder::new(init_seed)
			.account_type(AccountType::RegularAccountUpdatableCode)
			.storage_mode(AccountStorageMode::Public)
			.with_auth_component(AuthRpoFalcon512::new(alice_sk.public_key()))
			.with_component(BasicWallet);

		let (alice_account, alice_seed) = builder.build().unwrap();

		// Add the account to the client
		client_two.add_account(&alice_account, Some(alice_seed), false).await.unwrap();

		// Add the key pair to the keystore
		keystore.add_key(&AuthSecretKey::RpoFalcon512(alice_sk.clone())).unwrap();

		client_two.sync_state().await.unwrap();

		// account 1

		// Account seed
		let mut init_seed = [0_u8; 32];
		client_two.rng().fill_bytes(&mut init_seed);

		let bob_sk = SecretKey::with_rng(client_two.rng());

		// Build the account
		let builder = AccountBuilder::new(init_seed)
			.account_type(AccountType::RegularAccountUpdatableCode)
			.storage_mode(AccountStorageMode::Public)
			.with_auth_component(AuthRpoFalcon512::new(bob_sk.public_key()))
			.with_component(BasicWallet);

		let (bob_account, bob_seed) = builder.build().unwrap();

		// Add the account to the client
		client_two.add_account(&bob_account, Some(bob_seed), false).await.unwrap();

		// Add the key pair to the keystore
		keystore.add_key(&AuthSecretKey::RpoFalcon512(bob_sk.clone())).unwrap();

		client_two.sync_state().await.unwrap();

		// multisig account
		//

		println!("start multisig");

		let mut multisig_client = MultisigClient::new(client_two);

		let multisig_account = multisig_client
			.setup_account([alice_sk.public_key(), bob_sk.public_key()].to_vec(), 1)
			.await
			.unwrap();

		multisig_client.sync_state().await.unwrap();

		let mint_request = {
			let asset = FungibleAsset::new(faucet_account.id(), 115).unwrap();
			TransactionRequestBuilder::new()
				.build_mint_fungible_asset(
					asset,
					multisig_account.id(),
					NoteType::Public,
					multisig_client.rng(),
				)
				.unwrap()
		};

		let mint_note_ids = mint_request.expected_output_own_notes().iter().map(Note::id).collect();

		let tx_result =
			client_one.new_transaction(faucet_account.id(), mint_request).await.unwrap();

		client_one.submit_transaction(tx_result).await.unwrap();
		client_one.sync_state().await.unwrap();
		tokio::time::sleep(Duration::from_secs(10)).await;

		multisig_client.sync_state().await.unwrap();
		for &nid in &mint_note_ids {
			multisig_client.import_note(NoteFile::NoteId(nid)).await.unwrap();
		}

		multisig_client.sync_state().await.unwrap();

		let receive_tx_request = {
			for &nid in &mint_note_ids {
				println!(
					"note id = {nid}, note = {:?}",
					multisig_client.get_input_note(nid).await.unwrap()
				);
			}

			TransactionRequestBuilder::new().build_consume_notes(mint_note_ids).unwrap()
		};

		let tx_summary = multisig_client
			.propose_multisig_transaction(multisig_account.id(), receive_tx_request.clone())
			.await
			.unwrap();

		multisig_client.sync_state().await.unwrap();

		let tx_summary_commitment = tx_summary.to_commitment();

		// let alice_sig = alice_sk.sign(tx_summary_commitment);
		let bob_sig = alice_sk.sign(tx_summary_commitment);

		// if !bob_sig.verify(tx_summary_commitment, bob_sk.public_key().into()) {
		// 	panic!("verification failed");
		// }

		let bob_sig_felt_vec = miden_falcon_sign_test::turn_sig_into_felt_vec(bob_sig);

		multisig_client.sync_state().await.unwrap();

		let tx_result = multisig_client
			.new_multisig_transaction(
				&multisig_account,
				receive_tx_request,
				tx_summary,
				[None, Some(bob_sig_felt_vec)].to_vec(),
			)
			.await
			.unwrap();

		multisig_client.submit_transaction(tx_result).await.unwrap();

		multisig_client.sync_state().await.unwrap();

		tokio::time::sleep(Duration::from_secs(2)).await;

		multisig_client.sync_state().await.unwrap();

		let multisig_account =
			multisig_client.get_account(multisig_account.id()).await.unwrap().unwrap();

		for asset in multisig_account.account().vault().assets() {
			println!("asset = {asset:?}");
		}

		// account 3

		// Account seed
		let mut init_seed = [0_u8; 32];
		multisig_client.rng().fill_bytes(&mut init_seed);

		let charlie_sk = SecretKey::with_rng(multisig_client.rng());

		// Build the account
		let builder = AccountBuilder::new(init_seed)
			.account_type(AccountType::RegularAccountUpdatableCode)
			.storage_mode(AccountStorageMode::Public)
			.with_auth_component(AuthRpoFalcon512::new(charlie_sk.public_key()))
			.with_component(BasicWallet);

		let (charlie_account, charlie_seed) = builder.build().unwrap();

		// Add the account to the client
		multisig_client.add_account(&charlie_account, Some(charlie_seed), false).await.unwrap();

		// Add the key pair to the keystore
		keystore.add_key(&AuthSecretKey::RpoFalcon512(charlie_sk.clone())).unwrap();

		multisig_client.sync_state().await.unwrap();

		let send_request = {
			let asset = FungibleAsset::new(faucet_account.id(), 100).unwrap();
			let description = PaymentNoteDescription::new(
				vec![asset.into()],
				multisig_account.account().id(),
				charlie_account.id(),
			);

			TransactionRequestBuilder::new()
				.build_pay_to_id(description, NoteType::Public, multisig_client.rng())
				.unwrap()
		};

		let send_sumary = multisig_client
			.propose_multisig_transaction(multisig_account.account().id(), send_request.clone())
			.await
			.unwrap();

		let send_summary_commitment = send_sumary.to_commitment();

		let alice_sig = alice_sk.sign(send_summary_commitment);

		let alice_sig_felt_vec = miden_falcon_sign_test::turn_sig_into_felt_vec(alice_sig);

		multisig_client.sync_state().await.unwrap();

		let tx_result = multisig_client
			.new_multisig_transaction(
				multisig_account.account(),
				send_request,
				send_sumary,
				[Some(alice_sig_felt_vec), None].to_vec(),
			)
			.await
			.unwrap();

		multisig_client.submit_transaction(tx_result).await.unwrap();

		multisig_client.sync_state().await.unwrap();

		tokio::time::sleep(Duration::from_secs(10)).await;

		multisig_client.sync_state().await.unwrap();

		let multisig_account =
			multisig_client.get_account(multisig_account.account().id()).await.unwrap().unwrap();

		for asset in multisig_account.account().vault().assets() {
			println!("asset = {asset:?}");
		}

		tokio::time::sleep(Duration::from_secs(10)).await;

		let consumable_notes =
			multisig_client.get_consumable_notes(Some(charlie_account.id())).await.unwrap();

		println!("consumable notes = {consumable_notes:?}");

		let nids = consumable_notes.iter().map(|(note, _)| note.id()).collect();

		let receive_request = TransactionRequestBuilder::new().build_consume_notes(nids).unwrap();

		multisig_client.sync_state().await.unwrap();

		let tx_result =
			multisig_client.new_transaction(charlie_account.id(), receive_request).await.unwrap();

		multisig_client.submit_transaction(tx_result).await.unwrap();

		tokio::time::sleep(Duration::from_secs(10)).await;

		multisig_client.sync_state().await.unwrap();

		println!("faucet = {}", faucet_account.id());
		println!("alice = {}", alice_account.id());
		println!("bob = {}", bob_account.id());
		println!("charlie = {}", charlie_account.id());
		println!("multisig = {}", multisig_account.account().id());
	}
}
