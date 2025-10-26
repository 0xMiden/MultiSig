//! # Configuration
//!
//! The server is configured through:
//! - Environment variables prefixed with `MIDENMULTISIG_`
//!
//! # Example
//!
//! ```bash
//! # Set environment variables
//! export MIDENMULTISIG_APP__LISTEN="0.0.0.0:59059"
//! export MIDENMULTISIG_APP__NETWORK_ID_HRP="mtst"
//! export MIDENMULTISIG_DB__DB_URL="postgres://user:pass@localhost/multisig"
//!
//! # Run the server
//! cargo run --bin miden-multisig-coordinator-server
//! ```
//!
//! # Logging
//!
//! Logging is controlled via the `RUST_LOG` environment variable. Defaults to `info` level.

use miden_client::account::NetworkId;
use miden_multisig_coordinator_engine::{MultisigClientRuntimeConfig, MultisigEngine};
use miden_multisig_coordinator_server::{App, config};
use miden_multisig_coordinator_store::MultisigStore;
use tokio::{net::TcpListener, runtime::Builder, task};
use tower_http::cors::CorsLayer;
use tracing::{Subscriber, subscriber};
use tracing_subscriber::{EnvFilter, Registry, fmt::format::FmtSpan, layer::SubscriberExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = task::spawn_blocking(config::get_configuration).await??;

    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    subscriber::set_global_default(make_tracing_subscriber(env_filter))?;

    let app = {
        let store =
            miden_multisig_coordinator_store::establish_pool(config.db.db_url, config.db.max_conn)
                .await
                .map(MultisigStore::new)?;

        let network_id = NetworkId::new(&config.app.network_id_hrp)?;
        let rt = Builder::new_current_thread().enable_all().build()?;
        let multisig_client_rt_config = MultisigClientRuntimeConfig::builder()
            .node_url(config.miden.node_url.parse()?)
            .store_path(config.miden.store_path.into())
            .keystore_path(config.miden.keystore_path.into())
            .timeout(config.miden.timeout)
            .build();

        let engine = MultisigEngine::new(network_id, store)
            .start_multisig_client_runtime(rt, multisig_client_rt_config)
            .await?;

        App::builder().engine(engine.into()).build()
    };

    let axum_handle = {
        let router =
            miden_multisig_coordinator_server::create_router(app).layer(CorsLayer::permissive());

        let listener = TcpListener::bind(&config.app.listen)
            .await
            .inspect(|_| tracing::info!("server listening at {}", config.app.listen))?;

        tokio::spawn(async { axum::serve(listener, router).await })
    };

    axum_handle.await??;

    Ok(())
}

fn make_tracing_subscriber(env_filter: EnvFilter) -> impl Subscriber {
    Registry::default()
        .with(
            tracing_subscriber::fmt::layer()
                .with_target(false)
                .with_line_number(true)
                .with_span_events(FmtSpan::NEW | FmtSpan::CLOSE),
        )
        .with(env_filter)
}
