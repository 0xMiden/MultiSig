//! # Configuration
//!
//! The server is configured through:
//! - Base configuration file (`base_config.ron`)
//! - Environment variables prefixed with `MIDENMULTISIG_` (override base config)
//!
//! ## Base Configuration
//!
//! The default configuration is loaded from `base_config.ron`:
//!
//! ```ron
//! Config(
//!     app: AppConfig(
//!         listen: "localhost:59059",
//!         network_id_hrp: "mtst",
//!         cors_allowed_origins: ["*"],
//!     ),
//!     db: DbConfig(
//!         db_url: "postgres://multisig:multisig_password@localhost:5432/multisig",
//!         max_conn: 10,
//!     ),
//!     miden: MidenConfig(
//!         node_url: "https://rpc.testnet.miden.io:443",
//!         store_path: "./store.sqlite3",
//!         keystore_path: "./keystore",
//!         timeout: "30s",
//!     ),
//! )
//! ```
//!
//! ## Environment Variable Overrides
//!
//! Use double underscores (`__`) to override nested configuration fields:
//!
//! ```bash
//! # Override app config
//! export MIDENMULTISIG_APP__LISTEN="0.0.0.0:59059"
//! export MIDENMULTISIG_APP__NETWORK_ID_HRP="mtst"
//!
//! # Configure CORS allowed origins
//! # For specific origins (recommended)
//! export MIDENMULTISIG_APP__CORS_ALLOWED_ORIGINS='["http://localhost:3000", "http://localhost:3001"]'
//!
//! # Override database config
//! export MIDENMULTISIG_DB__DB_URL="postgres://user:pass@localhost/multisig"
//! export MIDENMULTISIG_DB__MAX_CONN="20"
//!
//! # Override miden config
//! export MIDENMULTISIG_MIDEN__NODE_URL="https://rpc.testnet.miden.io:443"
//! export MIDENMULTISIG_MIDEN__STORE_PATH="./store.sqlite3"
//! export MIDENMULTISIG_MIDEN__KEYSTORE_PATH="./keystore"
//! export MIDENMULTISIG_MIDEN__TIMEOUT="60s"
//!
//! # Run the server
//! cargo run --bin miden-multisig-coordinator-server
//! ```
//!
//! ## CORS Configuration
//!
//! The `cors_allowed_origins` field controls cross-origin resource sharing:
//! - **Empty array `[]`**: CORS is disabled
//! - **Specific origins**: Only listed origins are allowed (recommended for production)
//! - **Wildcard `["*"]`**: All origins are allowed (permissive mode, default for development)
//!
//! By default, the base configuration uses `["*"]` to allow all CORS requests for local development
//! convenience. For production deployments, it's recommended to override this with specific allowed origins.
//!
//! When specific origins are configured, the server allows:
//! - Methods: GET, POST, PUT, DELETE, OPTIONS
//! - Headers: Content-Type, Authorization
//! - Credentials: Enabled
//!
//! # Logging
//!
//! Logging is controlled via the `RUST_LOG` environment variable. Defaults to `info` level.
//!
//! The server logs:
//! - **HTTP requests**: Method, path, status code, and duration for all incoming requests
//! - **Client errors (4xx)**: Logged at `WARN` level with error details
//! - **Server errors (5xx)**: Logged at `ERROR` level with error details
//! - **Not found (404)**: Logged at `INFO` level
//!
//! Example log output:
//! ```text
//! INFO server listening at localhost:59059
//! INFO request{method=POST path=/api/v1/multisig-tx/propose}
//! INFO request{method=POST path=/api/v1/multisig-tx/propose}: close time.busy=245ms time.idle=12.4µs
//! WARN client error: invalid account id address: ...
//! ERROR server error: multisig engine error: ...
//! ```

use core::str::FromStr;

use axum::http::{HeaderValue, Method, header};
use miden_client::account::NetworkId;
use miden_multisig_coordinator_engine::{MultisigClientRuntimeConfig, MultisigEngine};
use miden_multisig_coordinator_server::{App, config};
use miden_multisig_coordinator_store::MultisigStore;
use tokio::{net::TcpListener, runtime::Builder, task};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
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
        let router = miden_multisig_coordinator_server::create_router(app);
        let cors = create_cors_layer(&config.app.cors_allowed_origins)?;
        let router = router.layer(TraceLayer::new_for_http()).layer(cors);

        let listener = TcpListener::bind(&config.app.listen)
            .await
            .inspect(|_| tracing::info!("server listening at {}", config.app.listen))?;

        tokio::spawn(async { axum::serve(listener, router).await })
    };

    axum_handle.await??;

    Ok(())
}

fn create_cors_layer<S>(allowed_origins: &[S]) -> anyhow::Result<CorsLayer>
where
    S: AsRef<str>,
{
    if allowed_origins.iter().map(AsRef::as_ref).any(|s| s == "*") {
        return Ok(CorsLayer::permissive());
    }

    let origins: Vec<HeaderValue> = allowed_origins
        .iter()
        .map(AsRef::as_ref)
        .map(FromStr::from_str)
        .collect::<Result<_, _>>()?;

    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
        .allow_credentials(true);

    Ok(cors)
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
