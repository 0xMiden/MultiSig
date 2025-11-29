//! A client for managing multisig transactions.

#![cfg_attr(not(test), no_std)]

extern crate alloc;

mod error;

#[cfg(test)]
mod tests;

pub use self::error::MultisigClientError;

use core::{
    num::NonZeroU32,
    ops::{Deref, DerefMut},
};

use alloc::{string::ToString, vec::Vec};

use miden_client::{
    Client, ClientError, Felt, Word, ZERO,
    account::{
        Account, AccountBuilder, AccountId, AccountStorageMode, AccountType,
        component::{AuthRpoFalcon512Multisig, AuthRpoFalcon512MultisigConfig, BasicWallet},
    },
    auth::{PublicKeyCommitment, TransactionAuthenticator},
    crypto::Rpo256,
    transaction::{
        TransactionExecutorError, TransactionRequest, TransactionResult, TransactionSummary,
    },
};
use rand::RngCore;

use self::error::{
    SetupAccountError, TransactionExecutionError, TransactionProposalError,
    TransactionSubmissionError,
};

/// A client for interacting with multisig accounts.
pub struct MultisigClient<AUTH> {
    client: Client<AUTH>,
}

impl<AUTH> MultisigClient<AUTH> {
    /// Construct a `MultisigClient` by providing a [Client].
    pub fn new(client: Client<AUTH>) -> Self {
        Self { client }
    }
}

impl<AUTH> MultisigClient<AUTH>
where
    AUTH: TransactionAuthenticator,
{
    /// Sets up a new multisig account with the specified `approvers` and `threshold`.
    /// The parameter `threshold` must not exceed the total number of `approvers`.
    pub async fn setup_account(
        &mut self,
        approvers: Vec<PublicKeyCommitment>,
        threshold: NonZeroU32,
    ) -> Result<Account, MultisigClientError> {
        let mut init_seed = [0u8; 32];
        self.rng().fill_bytes(&mut init_seed);

        let multisig_auth_component =
            AuthRpoFalcon512MultisigConfig::new(approvers, threshold.get())
                .and_then(AuthRpoFalcon512Multisig::new)
                .map_err(SetupAccountError::from)?;

        let multisig_account = AccountBuilder::new(init_seed)
            .with_auth_component(multisig_auth_component)
            .account_type(AccountType::RegularAccountImmutableCode)
            .storage_mode(AccountStorageMode::Public)
            .with_component(BasicWallet)
            .build()
            .map_err(SetupAccountError::from)?;

        self.add_account(&multisig_account, false)
            .await
            .map_err(SetupAccountError::from)?;

        Ok(multisig_account)
    }
}

impl<AUTH> MultisigClient<AUTH>
where
    AUTH: TransactionAuthenticator + Sync + 'static,
{
    const CONFIG_STORAGE_SLOT_INDEX: u8 = 0;

    const PUB_KEYS_STORAGE_SLOT_INDEX: u8 = 1;

    const NUM_APPROVERS_INDEX: usize = 1;

    /// Propose a multisig transaction.
    /// This is expected to "dry-run" and only return the [TransactionSummary].
    pub async fn propose_multisig_transaction(
        &mut self,
        account_id: AccountId,
        tx_request: TransactionRequest,
    ) -> Result<TransactionSummary, MultisigClientError> {
        let tx_result = self.execute_transaction(account_id, tx_request).await;

        match tx_result {
            Ok(_) => Err(TransactionProposalError::DryRunExpected)?,
            // otherwise match on Unauthorized
            Err(ClientError::TransactionExecutorError(TransactionExecutorError::Unauthorized(
                summary,
            ))) => Ok(*summary),
            Err(e) => Err(TransactionProposalError::Other(e.to_string().into()))?,
        }
    }

    /// Creates and executes a transaction specified by the request against the specified multisig
    /// account. It is expected to have at least `threshold` signatures from the approvers.
    pub async fn execute_multisig_transaction(
        &mut self,
        account: Account,
        mut tx_request: TransactionRequest,
        tx_summary: TransactionSummary,
        signatures: Vec<Option<Vec<Felt>>>,
    ) -> Result<TransactionResult, MultisigClientError> {
        let num_approvers: u32 = {
            let felt = *account
                .storage()
                .get_item(Self::CONFIG_STORAGE_SLOT_INDEX)
                .map_err(|e| {
                    TransactionExecutionError::StorageSlotIndexOutOfBounds(e.to_string().into())
                })?
                .as_elements()
                .get(Self::NUM_APPROVERS_INDEX)
                .ok_or(TransactionExecutionError::MissingNumApprovers)?;

            felt.try_into().map_err(|_| TransactionExecutionError::InvalidNumApprovers)?
        };

        if signatures.len()
            != usize::try_from(num_approvers)
                .map_err(|_| TransactionExecutionError::UnsupportedNumApprovers)?
        {
            Err(TransactionExecutionError::NumSignaturesMismatch)?;
        }

        let msg = tx_summary.to_commitment();

        // Add signatures to the advice provider
        for (i, sig) in
            (0..num_approvers).zip(signatures).filter_map(|(i, sig)| sig.map(|s| (i, s)))
        {
            let sig_key = {
                let pub_key = {
                    let pub_key_index_word = Word::from([Felt::from(i), ZERO, ZERO, ZERO]);
                    account
                        .storage()
                        .get_map_item(Self::PUB_KEYS_STORAGE_SLOT_INDEX, pub_key_index_word)
                        .map_err(|_| TransactionExecutionError::PubKeyStorageSlotMap)?
                };
                Rpo256::merge(&[pub_key, msg])
            };

            tx_request.advice_map_mut().insert(sig_key, sig);
        }

        // TODO as sanity check we should verify that we have enough signatures

        self.execute_transaction(account.id(), tx_request)
            .await
            .map_err(|e| MultisigClientError::TxExecution(e.to_string().into()))
    }

    /// Creates and executes a transaction specified by the request against the specified multisig
    /// account, submits it to the network, and update the local database.
    /// It is expected to have at least `threshold` signatures from the approvers.
    pub async fn submit_new_multisig_transaction(
        &mut self,
        account: Account,
        tx_request: TransactionRequest,
        tx_summary: TransactionSummary,
        signatures: Vec<Option<Vec<Felt>>>,
    ) -> Result<TransactionResult, MultisigClientError> {
        let tx_result = self
            .execute_multisig_transaction(account, tx_request, tx_summary, signatures)
            .await?;

        let proven_tx = self
            .prove_transaction(&tx_result)
            .await
            .map_err(|e| TransactionSubmissionError::TxProver(e.to_string().into()))?;

        let submission_height = self
            .submit_proven_transaction(proven_tx, &tx_result)
            .await
            .map_err(|e| TransactionSubmissionError::ProvenTxSubmission(e.to_string().into()))?;

        self.apply_transaction(&tx_result, submission_height)
            .await
            .map_err(|e| TransactionSubmissionError::ApplyTx(e.to_string().into()))?;

        Ok(tx_result)
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
