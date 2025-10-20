use core::num::NonZeroUsize;

use diesel_async::{
    AsyncPgConnection,
    pooled_connection::{
        AsyncDieselConnectionManager,
        deadpool::{BuildError, Object, Pool},
    },
};

/// A connection pool for managing PostgreSQL database connections.
///
/// This is a type alias for a deadpool-managed connection pool that handles
/// asynchronous PostgreSQL connections through Diesel. The pool automatically
/// manages connection lifecycle, reuse, and limits.
pub type DbPool = Pool<AsyncPgConnection>;

/// A connection from the database pool.
///
/// This is a type alias for a pooled connection object that provides access
/// to an asynchronous PostgreSQL connection. When dropped, the connection is
/// automatically returned to the pool for reuse.
pub type DbConn = Object<AsyncPgConnection>;

/// Establishes a connection pool to the PostgreSQL database.
///
/// Creates and configures a connection pool with the specified maximum size.
///
/// # Returns
///
/// Returns a configured [DbPool] on success, or a [BuildError] if pool creation fails.
///
/// # Errors
///
/// This function will return an error if:
/// - The connection URL is malformed
/// - The pool configuration is invalid
/// - Initial connection validation fails
#[tracing::instrument(skip(url))]
pub async fn establish_pool<U>(url: U, max_size: NonZeroUsize) -> Result<DbPool, BuildError>
where
    String: From<U>,
{
    Pool::builder(AsyncDieselConnectionManager::new(url))
        .max_size(max_size.get())
        .build()
}
