use std::borrow::Cow;

use miden_client::ClientError;
use miden_multisig_client::MultisigClientError;

pub type Result<T, E = MultisigClientRuntimeError> = core::result::Result<T, E>;

/// Errors that can occur in the multisig client runtime.
#[derive(Debug, thiserror::Error)]
pub enum MultisigClientRuntimeError {
    /// Error from the underlying client.
    #[error("client error: {0}")]
    Client(#[from] ClientError),

    /// Error from the multisig-specific client operations.
    ///
    /// This includes errors specific to multisig account management and
    /// transaction operations.
    #[error("multisig client error: {0}")]
    MultisigClient(#[from] MultisigClientError),

    /// Error sending a response back through the oneshot channel.
    ///
    /// This typically indicates that the receiver (the calling thread) has been
    /// dropped before the response could be sent, possibly due to a timeout or
    /// cancellation.
    #[error("sender error")]
    Sender,

    /// A catch-all error for other runtime issues.
    ///
    /// This includes configuration errors, initialization failures, or other issues.
    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

impl MultisigClientRuntimeError {
    /// Creates an `Other` error from any type that can be converted to a string.
    pub fn other<E>(err: E) -> Self
    where
        Cow<'static, str>: From<E>,
    {
        Self::Other(err.into())
    }
}
