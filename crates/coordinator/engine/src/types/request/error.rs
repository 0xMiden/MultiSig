use std::borrow::Cow;

/// Top-level error for request validation.
///
/// This enum wraps all possible request validation errors.
#[derive(Debug, thiserror::Error)]
pub enum RequestError {
    /// Error creating a multisig account request.
    #[error("create multisig account error: {0}")]
    CreateMultisigAccount(#[from] CreateMultisigAccountRequestError),
}

/// Errors that can occur when validating a multisig account creation request.
#[derive(Debug, thiserror::Error)]
pub enum CreateMultisigAccountRequestError {
    /// The approvers list is empty
    #[error("empty approvers error")]
    EmptyApprovers,

    /// The public key commitments list is empty
    #[error("empty pub key commits error")]
    EmptyPubKeyCommits,

    /// The approvers and public key commitments lists have different lengths
    #[error("approvers and pub key commits length mismatch")]
    ApproversPubKeyCommitsLengthMismatch,

    /// The threshold exceeds the number of approvers
    #[error("excess threshold error: threshold exceeds number of approvers")]
    ExcessThreshold,

    /// Other validation error
    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

impl CreateMultisigAccountRequestError {
    pub(crate) fn other<E>(err: E) -> Self
    where
        Cow<'static, str>: From<E>,
    {
        Self::Other(err.into())
    }
}
