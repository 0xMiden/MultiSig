#![allow(missing_docs)]

use miden_client::account::NetworkId;
use miden_multisig_coordinator_engine::{MultisigClientRuntimeConfig, MultisigEngine};
use miden_multisig_coordinator_server::{App, config};
use miden_multisig_coordinator_store::MultisigStore;
use tokio::{net::TcpListener, runtime::Builder, task};
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = task::spawn_blocking(config::get_configuration).await??;

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
            .start_multisig_client_runtime(rt, multisig_client_rt_config);

        App::builder().engine(engine.into()).build()
    };

    let axum_handle = {
        let listener = TcpListener::bind(config.app.listen).await?;
        let router =
            miden_multisig_coordinator_server::create_router(app).layer(CorsLayer::permissive());

        tokio::spawn(async { axum::serve(listener, router).await })
    };

    axum_handle.await??;

    Ok(())
}
