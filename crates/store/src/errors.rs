use std::borrow::Cow;

use crate::persistence::store::StoreError;

pub type Result<T, E = MultisigStoreError> = core::result::Result<T, E>;

/// Errors that can occur when interacting with the store
#[derive(Debug, thiserror::Error)]
pub enum MultisigStoreError {
    #[error("database error: {0}")]
    Store(#[from] StoreError),

    #[error("validation error: {0}")]
    Validation(String),

    #[error("not found error: {0}")]
    NotFound(String),

    #[error("serialization error: {0}")]
    Serialization(Cow<'static, str>),

    #[error("pool error")]
    Pool,

    #[error("invalid value error")]
    InvalidValue,

    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

impl From<chrono::ParseError> for MultisigStoreError {
    fn from(err: chrono::ParseError) -> Self {
        MultisigStoreError::Serialization(err.to_string().into())
    }
}
