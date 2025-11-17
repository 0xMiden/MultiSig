use diesel_async::pooled_connection::deadpool::BuildError;
use tokio::task::JoinError;

#[derive(Debug, thiserror::Error)]
pub enum PoolError {
    #[error("join error: {0}")]
    Join(#[from] JoinError),

    #[error("build error: {0}")]
    Build(#[from] BuildError),

    #[error("rustls error: {0}")]
    Rustls(#[from] rustls::Error),

    #[error("tokio postgres error: {0}")]
    TokioPostgres(#[from] tokio_postgres::Error),
}
