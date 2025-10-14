use std::borrow::Cow;

#[derive(Debug, thiserror::Error)]
pub enum RequestError {
    #[error("create multisig account error: {0}")]
    CreateMultisigAccount(#[from] CreateMultisigAccountRequestError),
}

#[derive(Debug, thiserror::Error)]
pub enum CreateMultisigAccountRequestError {
    #[error("empty approvers error")]
    EmptyApprovers,

    #[error("empty pub key commits error")]
    EmptyPubKeyCommits,

    #[error("approvers and pub key commits length mismatch")]
    ApproversPubKeyCommitsLengthMismatch,

    #[error("excess threshold error: threshold exceeds number of approvers")]
    ExcessThreshold,

    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

impl CreateMultisigAccountRequestError {
    pub fn other<E>(err: E) -> Self
    where
        Cow<'static, str>: From<E>,
    {
        Self::Other(err.into())
    }
}
