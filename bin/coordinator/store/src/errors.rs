use std::borrow::Cow;

use crate::persistence::store::StoreError;

pub type Result<T, E = MultisigStoreError> = core::result::Result<T, E>;

/// Errors that can occur when interacting with the store
#[derive(Debug, thiserror::Error)]
pub enum MultisigStoreError {
    /// Store error
    #[error("database error: {0}")]
    Store(#[from] StoreError),

    /// Validation error
    #[error("validation error: {0}")]
    Validation(Cow<'static, str>),

    /// Not found error
    #[error("not found error: {0}")]
    NotFound(Cow<'static, str>),

    /// Serialization error
    #[error("serialization error: {0}")]
    Serialization(Cow<'static, str>),

    /// Pool error
    #[error("pool error")]
    Pool,

    /// Invalid value error
    #[error("invalid value error")]
    InvalidValue,

    /// Other error
    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

impl From<chrono::ParseError> for MultisigStoreError {
    fn from(err: chrono::ParseError) -> Self {
        MultisigStoreError::Serialization(err.to_string().into())
    }
}
