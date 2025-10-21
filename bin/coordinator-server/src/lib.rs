#![allow(missing_docs)]

pub mod config;

mod error;
mod payload;
mod routes;

use std::sync::Arc;

use axum::{Router, routing};
use bon::Builder;
use dissolve_derive::Dissolve;
use miden_multisig_coordinator_engine::{MultisigEngine, Started};

pub fn create_router(app: App) -> Router {
    Router::new()
        .route("/health", routing::get(routes::health))
        .route(
            "/api/v1/multisig-account/create",
            routing::post(routes::create_multisig_account),
        )
        .route("/api/v1/multisig-tx/propose", routing::post(routes::propose_multisig_tx))
        .route("/api/v1/signature/add", routing::post(routes::add_signature))
        .route("/api/v1/consumable-notes/list", routing::post(routes::get_consumable_notes))
        .route(
            "/api/v1/multisig-account/details",
            routing::post(routes::get_multisig_account_details),
        )
        .route("/api/v1/multisig-tx/list", routing::post(routes::list_multisig_tx))
        .with_state(app)
}

#[derive(Clone, Builder, Dissolve)]
pub struct App {
    engine: Arc<MultisigEngine<Started>>,
}
