use std::borrow::Cow;

use crate::persistence::store::StoreError;

pub type Result<T, E = MultisigStoreError> = core::result::Result<T, E>;

/// Errors that can occur when interacting with the store
#[derive(Debug, thiserror::Error)]
pub enum MultisigStoreError {
    /// A database-level error occurred.
    ///
    /// This wraps errors from the underlying persistence layer, including
    /// connection issues, query failures, and transaction errors.
    #[error("database error: {0}")]
    Store(#[from] StoreError),

    /// A validation error occurred while processing input data.
    ///
    /// This is returned when data fails business logic validation rules,
    /// such as invalid threshold values or mismatched approver counts.
    #[error("validation error: {0}")]
    Validation(Cow<'static, str>),

    /// The requested resource was not found in the database.
    ///
    /// This is returned when querying for entities that don't exist,
    /// such as non-existent transaction IDs or account ids.
    #[error("not found error: {0}")]
    NotFound(Cow<'static, str>),

    /// A serialization or deserialization error occurred.
    ///
    /// This is returned when converting between internal representations
    /// and database-stored byte formats fails.
    #[error("serialization error: {0}")]
    Serialization(Cow<'static, str>),

    /// Failed to acquire a database connection from the pool.
    ///
    /// This typically indicates the connection pool is exhausted or
    /// the database is unavailable.
    #[error("pool error")]
    Pool,

    /// An invalid value was encountered during processing.
    ///
    /// This is returned when data retrieved from the database cannot be
    /// converted to the expected type or format.
    #[error("invalid value error")]
    InvalidValue,

    /// An unclassified error occurred.
    ///
    /// This is used for errors that don't fit into the other categories.
    #[error("other error: {0}")]
    Other(Cow<'static, str>),
}

impl From<chrono::ParseError> for MultisigStoreError {
    fn from(err: chrono::ParseError) -> Self {
        MultisigStoreError::Serialization(err.to_string().into())
    }
}
