//! Request types for multisig engine operations.

mod error;

pub use self::error::{CreateMultisigAccountRequestError, RequestError};

use core::num::NonZeroU32;

use bon::Builder;
use dissolve_derive::Dissolve;
use miden_client::{
    account::AccountId, auth::PublicKeyCommitment, crypto::rpo_falcon512::Signature,
    transaction::TransactionRequest,
};
use miden_multisig_coordinator_domain::tx::{MultisigTxId, MultisigTxStatus};

/// Request to create a new multisig account.
///
/// # Validation
///
/// The request validates that:
/// - `approvers` and `pub_key_commits` are both non-empty have the same length
/// - The threshold doesn't exceed the number of approvers
#[derive(Debug, Dissolve)]
pub struct CreateMultisigAccountRequest {
    /// Minimum number of signatures required to execute transactions
    threshold: NonZeroU32,

    /// List of accounts that can approve transactions
    approvers: Vec<AccountId>,

    /// Corresponding public key commitments for each approver
    pub_key_commits: Vec<PublicKeyCommitment>,
}

/// Request to query consumable notes.
#[derive(Debug, Builder, Dissolve)]
pub struct GetConsumableNotesRequest {
    /// Optional account filter. If `None`, returns notes for all accounts.
    account_id: Option<AccountId>,
}

/// Request to propose a new multisig transaction.
#[derive(Debug, Builder, Dissolve)]
pub struct ProposeMultisigTxRequest {
    /// The multisig account to which the transaction applies
    multisig_account_id: AccountId,

    /// The transaction request
    tx_request: TransactionRequest,
}

/// Request to add an approver's signature to a pending transaction.
#[derive(Debug, Builder, Dissolve)]
pub struct AddSignatureRequest {
    /// The transaction ID to add a signature to
    tx_id: MultisigTxId,

    /// The account of the approver adding their signature
    approver: AccountId,

    /// The cryptographic signature
    signature: Signature,
}

/// Request to retrieve a multisig account by id.
#[derive(Debug, Builder, Dissolve)]
pub struct GetMultisigAccountRequest {
    /// The multisig account id to look up
    multisig_account_id: AccountId,
}

/// Request to list approvers for a multisig account.
#[derive(Debug, Builder, Dissolve)]
pub struct ListMultisigApproverRequest {
    /// The multisig account id to query
    multisig_account_id: AccountId,
}

/// Request to retrieve transaction statistics for a multisig account.
#[derive(Debug, Builder, Dissolve)]
pub struct GetMultisigTxStatsRequest {
    /// The multisig account id to query
    multisig_account_id: AccountId,
}

/// Request to list transactions for a multisig account.
#[derive(Debug, Builder, Dissolve)]
pub struct ListMultisigTxRequest {
    /// The multisig account id to query
    multisig_account_id: AccountId,

    /// Optional status filter (Pending, Success, Failure)
    tx_status_filter: Option<MultisigTxStatus>,
}

#[bon::bon]
impl CreateMultisigAccountRequest {
    /// Creates a new multisig account creation request with validation.
    ///
    /// # Parameters
    ///
    /// * `threshold` - Number of signatures required (must not exceed the number of approvers)
    /// * `approvers` - List of approver account ids
    /// * `pub_key_commits` - List of public key commitments (must match approver count)
    ///
    /// Returns an error if validation fails.
    #[builder]
    pub fn new(
        threshold: NonZeroU32,
        approvers: Vec<AccountId>,
        pub_key_commits: Vec<PublicKeyCommitment>,
    ) -> Result<Self, CreateMultisigAccountRequestError> {
        if approvers.is_empty() {
            return Err(CreateMultisigAccountRequestError::EmptyApprovers);
        }

        if pub_key_commits.is_empty() {
            return Err(CreateMultisigAccountRequestError::EmptyPubKeyCommits);
        }

        if approvers.len() != pub_key_commits.len() {
            return Err(CreateMultisigAccountRequestError::ApproversPubKeyCommitsLengthMismatch);
        }

        let threshold_usize = usize::try_from(threshold.get())
            .map_err(|e| CreateMultisigAccountRequestError::other(e.to_string()))?;

        if threshold_usize > approvers.len() {
            return Err(CreateMultisigAccountRequestError::ExcessThreshold);
        }

        Ok(Self { threshold, approvers, pub_key_commits })
    }
}
