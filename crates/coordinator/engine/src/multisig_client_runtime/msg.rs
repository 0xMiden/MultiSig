use core::num::NonZeroU32;

use bon::Builder;
use dissolve_derive::Dissolve;
use miden_client::{
    account::{Account, AccountId},
    auth::PublicKeyCommitment,
    crypto::rpo_falcon512::Signature,
    note::NoteConsumability,
    store::InputNoteRecord,
    transaction::{TransactionRequest, TransactionResult, TransactionSummary},
};
use miden_multisig_client::MultisigClientError;
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
    approvers: Vec<PublicKeyCommitment>,
    sender: oneshot::Sender<Result<Account, MultisigClientError>>,
}

#[derive(Debug, Builder, Dissolve)]
pub struct GetConsumableNotes {
    account_id: Option<AccountId>,
    sender: oneshot::Sender<Vec<(InputNoteRecord, Vec<NoteConsumability>)>>,
}

#[derive(Debug, Builder, Dissolve)]
pub struct ProposeMultisigTx {
    multisig_account_id: AccountId,
    tx_request: TransactionRequest,
    sender: oneshot::Sender<Result<TransactionSummary, MultisigClientError>>,
}

#[derive(Debug, Builder, Dissolve)]
pub struct ProcessMultisigTx {
    multisig_account_id: AccountId,
    tx_request: TransactionRequest,
    tx_summary: TransactionSummary,
    signatures: Vec<Option<Signature>>,
    sender: oneshot::Sender<Result<TransactionResult, MultisigClientError>>,
}
