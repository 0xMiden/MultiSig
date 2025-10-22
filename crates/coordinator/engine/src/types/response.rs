//! Response types for multisig engine operations.

use dissolve_derive::Dissolve;
use miden_client::account::Account;
use miden_multisig_coordinator_domain::{
    MultisigApprover,
    account::MultisigAccount,
    tx::{MultisigTx, MultisigTxId},
};
use miden_objects::transaction::TransactionSummary;

/// Response from creating a multisig account.
///
/// Contains both the blockchain account and the coordinator's view of the persisted multisig account.
#[derive(Debug, Dissolve)]
pub struct CreateMultisigAccountResponse {
    /// The account object from the [`MultisigClient`](miden_multisig_client::MultisigClient)
    miden_account: Account,

    /// The coordinator's view of the persisted multisig account
    multisig_account: MultisigAccount,
}

/// Response from proposing a multisig transaction.
#[derive(Debug, Dissolve)]
pub struct ProposeMultisigTxResponse {
    /// The unique identifier for the transaction in the coordinator's database
    tx_id: MultisigTxId,

    /// The transaction summary to be signed by approvers
    tx_summary: TransactionSummary,
}

/// Response from retrieving a multisig account.
#[derive(Debug, Dissolve)]
pub struct GetMultisigAccountResponse {
    /// The account if found, `None` otherwise
    multisig_account: Option<MultisigAccount>,
}

/// Response from listing approvers for a multisig account.
#[derive(Debug, Dissolve)]
pub struct ListMultisigApproverResponse {
    /// List of approvers matching the query criteria
    approvers: Vec<MultisigApprover>,
}

/// Response from listing multisig transactions.
#[derive(Debug, Dissolve)]
pub struct ListMultisigTxResponse {
    /// List of transactions matching the query criteria
    txs: Vec<MultisigTx>,
}

#[bon::bon]
impl CreateMultisigAccountResponse {
    #[builder]
    pub(crate) fn new(miden_account: Account, multisig_account: MultisigAccount) -> Self {
        Self { miden_account, multisig_account }
    }
}

#[bon::bon]
impl ProposeMultisigTxResponse {
    #[builder]
    pub(crate) fn new(tx_id: MultisigTxId, tx_summary: TransactionSummary) -> Self {
        Self { tx_id, tx_summary }
    }
}

#[bon::bon]
impl GetMultisigAccountResponse {
    #[builder]
    pub(crate) fn new(multisig_account: Option<MultisigAccount>) -> Self {
        Self { multisig_account }
    }
}

#[bon::bon]
impl ListMultisigApproverResponse {
    #[builder]
    pub(crate) fn new(approvers: Vec<MultisigApprover>) -> Self {
        Self { approvers }
    }
}

#[bon::bon]
impl ListMultisigTxResponse {
    #[builder]
    pub(crate) fn new(txs: Vec<MultisigTx>) -> Self {
        Self { txs }
    }
}
