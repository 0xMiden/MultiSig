use std::borrow::Cow;

use miden_multisig_coordinator_store::MultisigStoreError;
use tokio::sync::oneshot;

use crate::miden_runtime::{
    MidenRuntimeError,
    msg::{ProcessMultisigTxError, ProposeMultisigTxError},
};

#[derive(Debug, thiserror::Error)]
#[error("multisig engine error: {0}")]
pub struct MultisigEngineError(#[from] MultisigEngineErrorKind);

#[derive(Debug, thiserror::Error)]
pub(crate) enum MultisigEngineErrorKind {
    #[error("miden runtime error: {0}")]
    MidenRuntime(#[from] MidenRuntimeError),

    #[error("multisig store error: {0}")]
    MultisigStore(#[from] MultisigStoreError),

    #[error("mpsc sender error: {0}")]
    MpscSender(Cow<'static, str>),

    #[error("oneshot receive error: {0}")]
    OneshotReceive(#[from] oneshot::error::RecvError),

    #[error("not found error: {0}")]
    NotFound(Cow<'static, str>),

    #[error("propose multisig tx error: {0}")]
    ProposeMultisigTx(#[from] ProposeMultisigTxError),

    #[error("process multisig tx error: {0}")]
    ProcessMultisigTx(#[from] ProcessMultisigTxError),

    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

impl MultisigEngineErrorKind {
    pub fn mpsc_sender<E>(err: E) -> Self
    where
        Cow<'static, str>: From<E>,
    {
        Self::MpscSender(err.into())
    }

    pub fn not_found<E>(err: E) -> Self
    where
        Cow<'static, str>: From<E>,
    {
        Self::NotFound(err.into())
    }

    pub fn other<E>(err: E) -> Self
    where
        Cow<'static, str>: From<E>,
    {
        Self::Other(err.into())
    }
}
