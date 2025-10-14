use dissolve_derive::Dissolve;
use miden_client::account::Account;
use miden_multisig_coordinator_domain::{account::MultisigAccount, tx::MultisigTxId};
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
