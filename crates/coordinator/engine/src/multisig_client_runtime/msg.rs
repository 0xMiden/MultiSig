use core::num::NonZeroU32;

use bon::Builder;
use dissolve_derive::Dissolve;
use miden_client::{
    account::{Account, AccountId},
    note::NoteConsumability,
    store::InputNoteRecord,
    transaction::{TransactionRequest, TransactionResult},
};
use miden_multisig_client::MultisigClientError;
use miden_objects::{
    crypto::dsa::rpo_falcon512::{PublicKey, Signature},
    transaction::TransactionSummary,
};
use tokio::sync::oneshot;

#[allow(clippy::large_enum_variant)]
pub enum MultisigClientRuntimeMsg {
    CreateMultisigAccount(CreateMultisigAccount),
    GetConsumableNotes(GetConsumableNotes),
    ProposeMultisigTx(ProposeMultisigTx),
    ProcessMultisigTx(ProcessMultisigTx),
    Shutdown,
}

#[derive(Debug, Builder, Dissolve)]
pub struct CreateMultisigAccount {
    threshold: NonZeroU32,
    approvers: Vec<PublicKey>,
    sender: oneshot::Sender<Account>,
}

#[derive(Debug, Builder, Dissolve)]
pub struct GetConsumableNotes {
    account_id: Option<AccountId>,
    sender: oneshot::Sender<Vec<(InputNoteRecord, Vec<NoteConsumability>)>>,
}

#[derive(Debug, Builder, Dissolve)]
pub struct ProposeMultisigTx {
    account_id: AccountId,
    tx_request: TransactionRequest,
    sender: oneshot::Sender<Result<TransactionSummary, ProposeMultisigTxError>>,
}

#[derive(Debug, Builder, Dissolve)]
pub struct ProcessMultisigTx {
    account_id: AccountId,
    tx_request: TransactionRequest,
    tx_summary: TransactionSummary,
    signatures: Vec<Option<Signature>>,
    sender: oneshot::Sender<Result<TransactionResult, ProcessMultisigTxError>>,
}

/// Error that occurs when proposing a multisig transaction.
#[derive(Debug, thiserror::Error)]
#[error("propose multisig tx error: {0}")]
pub struct ProposeMultisigTxError(#[from] MultisigClientError);

/// Error that occurs when processing a multisig transaction.
#[derive(Debug, thiserror::Error)]
#[error("process multisig tx error: {0}")]
pub struct ProcessMultisigTxError(#[from] MultisigClientError);
