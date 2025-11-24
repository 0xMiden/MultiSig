use alloc::{borrow::Cow, string::ToString};

use miden_client::{AccountError, ClientError};

/// Represents errors that can occur in the multisig client.
#[derive(Debug, thiserror::Error)]
pub enum MultisigClientError {
    /// An error occurred while setting up multisig account.
    #[error("setup account error: {0}")]
    SetupAccount(Cow<'static, str>),

    /// An error occurred while proposing a new transaction.
    #[error("tx proposal error: {0}")]
    TxProposal(Cow<'static, str>),

    /// An error occurred while executing a transaction.
    #[error("multisig tx execution error: {0}")]
    TxExecution(Cow<'static, str>),

    /// An error occurred while executing and submitting a transaction.
    #[error("tx submission error: {0}")]
    TxSubmission(Cow<'static, str>),
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum SetupAccountError {
    #[error("account error: {0}")]
    Account(#[from] AccountError),

    #[error("client error: {0}")]
    Client(#[from] ClientError),
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum TransactionProposalError {
    #[error("dry run expected but transaction got executed")]
    DryRunExpected,

    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum TransactionExecutionError {
    #[error("storage slot index out of bounds error: {0}")]
    StorageSlotIndexOutOfBounds(Cow<'static, str>),

    #[error("missing number of approvers at the storage slot")]
    MissingNumApprovers,

    #[error("invalid number of approvers at the storage slot")]
    InvalidNumApprovers,

    #[error("unsupported number of approvers at the storage slot")]
    UnsupportedNumApprovers,

    #[error("mismatch between number of signatures provided and number of approvers")]
    NumSingaturesMismatch,

    #[error("public key retrieval failure from storage slot map")]
    PubKeyStorageSlotMap,
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum TransactionSubmissionError {
    #[error("tx execution error: {0}")]
    TxExecution(#[from] TransactionExecutionError),

    #[error("tx prover error: {0}")]
    TxProver(Cow<'static, str>),

    #[error("proven tx submission error: {0}")]
    ProvenTxSubmission(Cow<'static, str>),

    #[error("apply tx error: {0}")]
    ApplyTx(Cow<'static, str>),
}

impl From<SetupAccountError> for MultisigClientError {
    fn from(err: SetupAccountError) -> Self {
        Self::SetupAccount(err.to_string().into())
    }
}

impl From<TransactionProposalError> for MultisigClientError {
    fn from(err: TransactionProposalError) -> Self {
        Self::TxProposal(err.to_string().into())
    }
}

impl From<TransactionExecutionError> for MultisigClientError {
    fn from(err: TransactionExecutionError) -> Self {
        Self::TxExecution(err.to_string().into())
    }
}

impl From<TransactionSubmissionError> for MultisigClientError {
    fn from(err: TransactionSubmissionError) -> Self {
        Self::TxSubmission(err.to_string().into())
    }
}
