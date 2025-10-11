use core::num::NonZeroUsize;

use diesel_async::{
    AsyncPgConnection,
    pooled_connection::{
        AsyncDieselConnectionManager,
        deadpool::{BuildError, Object, Pool},
    },
};

pub type DbPool = Pool<AsyncPgConnection>;
pub type DbConn = Object<AsyncPgConnection>;

/// Returns a [DbPool] with `max_size` connections with the Postgres database.
#[tracing::instrument(skip(url))]
pub async fn establish_pool<U>(url: U, max_size: NonZeroUsize) -> Result<DbPool, BuildError>
where
    String: From<U>,
{
    Pool::builder(AsyncDieselConnectionManager::new(url))
        .max_size(max_size.get())
        .build()
}
