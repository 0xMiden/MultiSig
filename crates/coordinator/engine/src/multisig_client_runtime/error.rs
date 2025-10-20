use std::borrow::Cow;

use miden_client::ClientError;
use miden_multisig_client::MultisigClientError;

pub type Result<T, E = MultisigClientRuntimeError> = core::result::Result<T, E>;

#[derive(Debug, thiserror::Error)]
pub enum MultisigClientRuntimeError {
    #[error("client error: {0}")]
    Client(#[from] ClientError),

    #[error("multisig client error: {0}")]
    MultisigClient(#[from] MultisigClientError),

    #[error("sender error")]
    Sender,

    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

impl MultisigClientRuntimeError {
    pub fn other<E>(err: E) -> Self
    where
        Cow<'static, str>: From<E>,
    {
        Self::Other(err.into())
    }
}
