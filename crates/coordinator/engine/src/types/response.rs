use dissolve_derive::Dissolve;
use miden_client::account::Account;
use miden_multisig_coordinator_domain::{
    account::MultisigAccount,
    tx::{MultisigTx, MultisigTxId},
};
use miden_objects::transaction::TransactionSummary;

#[derive(Debug, Dissolve)]
pub struct CreateMultisigAccountResponse {
    miden_account: Account,
    multisig_account: MultisigAccount,
}

#[derive(Debug, Dissolve)]
pub struct ProposeMultisigTxResponse {
    tx_id: MultisigTxId,
    tx_summary: TransactionSummary,
}

#[derive(Debug, Dissolve)]
pub struct GetMultisigAccountResponse {
    multisig_account: Option<MultisigAccount>,
}

#[derive(Debug, Dissolve)]
pub struct ListMultisigTxResponse {
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
impl ListMultisigTxResponse {
    #[builder]
    pub(crate) fn new(txs: Vec<MultisigTx>) -> Self {
        Self { txs }
    }
}
