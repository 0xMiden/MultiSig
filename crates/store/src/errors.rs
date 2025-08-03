use std::fmt;

/// Errors that can occur when interacting with the store
#[derive(Debug)]
pub enum StoreError {
    /// Database-related errors
    DatabaseError(String),
    /// Input validation errors
    ValidationError(String),
    /// Resource not found errors
    NotFound(String),
    /// Serialization/deserialization errors
    SerializationError(String),
}

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StoreError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            StoreError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            StoreError::NotFound(msg) => write!(f, "Not found: {}", msg),
            StoreError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<sqlx::Error> for StoreError {
    fn from(err: sqlx::Error) -> Self {
        StoreError::DatabaseError(err.to_string())
    }
}

impl From<chrono::ParseError> for StoreError {
    fn from(err: chrono::ParseError) -> Self {
        StoreError::SerializationError(err.to_string())
    }
}
