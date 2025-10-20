mod error;

pub use self::error::{CreateMultisigAccountRequestError, RequestError};

use core::num::NonZeroU32;

use bon::Builder;
use dissolve_derive::Dissolve;
use miden_client::{account::AccountIdAddress, transaction::TransactionRequest};
use miden_multisig_coordinator_domain::tx::{MultisigTxId, MultisigTxStatus};
use miden_objects::crypto::dsa::rpo_falcon512::{PublicKey, Signature};

#[derive(Debug, Dissolve)]
pub struct CreateMultisigAccountRequest {
    threshold: NonZeroU32,
    approvers: Vec<AccountIdAddress>,
    pub_key_commits: Vec<PublicKey>,
}

#[derive(Debug, Builder, Dissolve)]
pub struct GetConsumableNotesRequest {
    address: Option<AccountIdAddress>,
}

#[derive(Debug, Builder, Dissolve)]
pub struct ProposeMultisigTxRequest {
    address: AccountIdAddress,
    tx_request: TransactionRequest,
}

#[derive(Debug, Builder, Dissolve)]
pub struct AddSignatureRequest {
    tx_id: MultisigTxId,
    approver: AccountIdAddress,
    signature: Signature,
}

#[derive(Debug, Builder, Dissolve)]
pub struct GetMultisigAccountRequest {
    multisig_account_id_address: AccountIdAddress,
}

#[derive(Debug, Builder, Dissolve)]
pub struct ListMultisigTxRequest {
    multisig_account_id_address: AccountIdAddress,
    tx_status_filter: Option<MultisigTxStatus>,
}

#[bon::bon]
impl CreateMultisigAccountRequest {
    #[builder]
    pub fn new(
        threshold: NonZeroU32,
        approvers: Vec<AccountIdAddress>,
        pub_key_commits: Vec<PublicKey>,
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
