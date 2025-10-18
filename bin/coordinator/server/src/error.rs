use std::borrow::Cow;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use miden_multisig_coordinator_engine::{MultisigEngineError, request::RequestError};
use tokio::task::JoinError;

#[derive(Debug, thiserror::Error)]
pub(crate) enum AppError {
    #[error("multisig engine error: {0}")]
    MultisigEngine(Box<MultisigEngineError>),

    #[error("invalid network id")]
    InvalidNetworkId,

    #[error("invalid account id address: {0}")]
    InvalidAccountIdAddress(Cow<'static, str>),

    #[error("invalid pub key commit error")]
    InvalidPubKeyCommit,

    #[error("invalid transaction request error")]
    InvalidTransactionRequest,

    #[error("invalid signature error")]
    InvalidSignature,

    #[error("join error: {0}")]
    JoinError(#[from] JoinError),

    #[error("request error: {0}")]
    RequestError(#[from] RequestError),

    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

impl AppError {
    pub fn invalid_account_id_address<A>(address: A) -> Self
    where
        Cow<'static, str>: From<A>,
    {
        Self::InvalidAccountIdAddress(address.into())
    }

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

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let code = match self {
            AppError::InvalidNetworkId
            | AppError::InvalidAccountIdAddress(_)
            | AppError::InvalidPubKeyCommit
            | AppError::InvalidTransactionRequest
            | AppError::InvalidSignature
            | AppError::RequestError(_) => StatusCode::BAD_REQUEST,
            AppError::MultisigEngine(_) | AppError::JoinError(_) | AppError::Other(_) => {
                StatusCode::INTERNAL_SERVER_ERROR
            },
        };

        (code, self).into_response()
    }
}
