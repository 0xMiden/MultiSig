use std::borrow::Cow;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use miden_multisig_coordinator_engine::{MultisigEngineError, request::RequestError};
use miden_multisig_coordinator_utils::AccountIdAddressError;
use tokio::task::JoinError;

#[derive(Debug, thiserror::Error)]
pub(crate) enum AppError {
    #[error("multisig engine error: {0}")]
    MultisigEngine(Box<MultisigEngineError>),

    #[error("invalid network id error")]
    InvalidNetworkId,

    #[error("invalid account id address: {0}")]
    InvalidAccountIdAddress(Cow<'static, str>),

    #[error("invalid pub key commit error")]
    InvalidPubKeyCommit,

    #[error("invalid transaction request error")]
    InvalidTransactionRequest,

    #[error("invalid signature error")]
    InvalidSignature,

    #[error("invalid multisig tx status error")]
    InvalidMultisigTxStatus,

    #[error("multisig account not found error")]
    MultisigAccountNotFound,

    #[error("join error: {0}")]
    JoinError(#[from] JoinError),

    #[error("request error: {0}")]
    RequestError(#[from] RequestError),

    #[allow(dead_code)]
    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

impl AppError {
    #[allow(dead_code)]
    pub fn other<E>(err: E) -> Self
    where
        Cow<'static, str>: From<E>,
    {
        Self::Other(err.into())
    }
}

impl From<MultisigEngineError> for AppError {
    fn from(err: MultisigEngineError) -> Self {
        Self::MultisigEngine(err.into())
    }
}

impl From<AccountIdAddressError> for AppError {
    fn from(err: AccountIdAddressError) -> Self {
        Self::InvalidAccountIdAddress(err.to_string().into())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let code = match self {
            AppError::InvalidNetworkId
            | AppError::InvalidAccountIdAddress(_)
            | AppError::InvalidPubKeyCommit
            | AppError::InvalidTransactionRequest
            | AppError::InvalidSignature
            | AppError::InvalidMultisigTxStatus
            | AppError::RequestError(_) => {
                tracing::warn!("client error: {}", self);
                StatusCode::BAD_REQUEST
            },
            AppError::MultisigAccountNotFound => {
                tracing::info!("multisig account not found");
                StatusCode::NOT_FOUND
            },
            AppError::MultisigEngine(_) | AppError::JoinError(_) | AppError::Other(_) => {
                tracing::error!("server error: {}", self);
                StatusCode::INTERNAL_SERVER_ERROR
            },
        };

        (code, self.to_string()).into_response()
    }
}
