mod error;

pub use self::error::PoolError;

use core::num::NonZeroUsize;

use diesel::ConnectionError;
use diesel_async::{
    AsyncPgConnection,
    pooled_connection::{
        AsyncDieselConnectionManager, ManagerConfig,
        deadpool::{Object, Pool},
    },
};
use rustls::{ClientConfig, RootCertStore};
use rustls_native_certs::CertificateResult;
use tokio::task;
use tokio_postgres_rustls::MakeRustlsConnect;

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
pub async fn establish_pool<U>(url: U, max_size: NonZeroUsize) -> Result<DbPool, PoolError>
where
    String: From<U>,
{
    let tls = task::spawn_blocking(make_rustls_config).await??;

    let mut manager_config = ManagerConfig::default();
    manager_config.custom_setup = Box::new(move |url: &str| {
        let tls = tls.clone();
        let url = url.to_string();
        Box::pin(async move {
            let (client, conn) = tokio_postgres::connect(&url, tls)
                .await
                .map_err(|e| e.to_string())
                .map_err(ConnectionError::BadConnection)?;

            tokio::spawn(conn);

            AsyncPgConnection::try_from(client).await
        })
    });

    let manager =
        AsyncDieselConnectionManager::<AsyncPgConnection>::new_with_config(url, manager_config);

    Pool::builder(manager).max_size(max_size.get()).build().map_err(From::from)
}

fn make_rustls_config() -> Result<MakeRustlsConnect, rustls::Error> {
    let mut cert_store = RootCertStore::empty();
    let CertificateResult { certs, .. } = rustls_native_certs::load_native_certs();

    for cert in certs {
        cert_store.add(cert)?;
    }

    let config = ClientConfig::builder().with_root_certificates(cert_store).with_no_client_auth();

    Ok(MakeRustlsConnect::new(config))
}
