//! This crate provides an HTTP API server for to facilitate transactions for multisig accounts.
//! It exposes RESTful endpoints for creating multisig accounts, proposing transactions,
//! collecting signatures, querying multisig transactions and account details,
//! and executing transactions when the threshold is met.

pub mod config;

mod error;
mod payload;
mod routes;

use std::sync::Arc;

use axum::{Router, routing};
use bon::Builder;
use dissolve_derive::Dissolve;
use miden_multisig_coordinator_engine::{MultisigEngine, Started};

/// Creates and configures the main application router with all API endpoints.
///
/// # Endpoints
///
/// ## Health Check
///
/// **`GET /health`** - Check if the server is running.
///
/// ```bash
/// curl -X GET http://localhost:59059/health
/// ```
///
/// Response: `200 OK`
///
/// ---
///
/// ## Create Multisig Account
///
/// **`POST /api/v1/multisig-account/create`** - Creates a new multisig account with specified approvers and threshold.
///
/// ```bash
/// curl -X POST http://localhost:59059/api/v1/multisig-account/create \
///   -H "Content-Type: application/json" \
///   -d '{
///     "threshold": 2,
///     "approvers": [
///       "mtst1abc...",
///       "mtst1def...",
///       "mtst1ghi..."
///     ],
///     "pub_key_commits": [
///       "<base64_encoded_public_key_1>",
///       "<base64_encoded_public_key_2>",
///       "<base64_encoded_public_key_3>"
///     ]
///   }'
/// ```
///
/// Response:
/// ```json
/// {
///   "address": "mtst1xyz...",
///   "created_at": "2025-10-19T12:00:00Z",
///   "updated_at": "2025-10-19T12:00:00Z"
/// }
/// ```
///
/// ---
///
/// ## Propose Transaction
///
/// **`POST /api/v1/multisig-tx/propose`** - Proposes a new transaction for a multisig account.
///
/// ```bash
/// curl -X POST http://localhost:59059/api/v1/multisig-tx/propose \
///   -H "Content-Type: application/json" \
///   -d '{
///     "multisig_account_address": "mtst1xyz...",
///     "tx_request": "<base64_encoded_transaction_request>"
///   }'
/// ```
///
/// Response:
/// ```json
/// {
///   "tx_id": "550e8400-e29b-41d4-a716-446655440000",
///   "tx_summary": "<base64_encoded_transaction_summary>"
/// }
/// ```
///
/// ---
///
/// ## Add Signature
///
/// **`POST /api/v1/signature/add`** - Submits an approver's signature for a pending transaction.
/// If the signature threshold is met, the transaction is automatically processed.
///
/// ```bash
/// curl -X POST http://localhost:59059/api/v1/signature/add \
///   -H "Content-Type: application/json" \
///   -d '{
///     "tx_id": "550e8400-e29b-41d4-a716-446655440000",
///     "approver": "mtst1abc...",
///     "signature": "<base64_encoded_signature>"
///   }'
/// ```
///
/// Response:
/// ```json
/// {
///   "tx_result": "<base64_encoded_transaction_result_if_threshold_met>"
/// }
/// ```
///
/// Note: `tx_result` is `null` if threshold is not yet met, or contains the base64-encoded
/// transaction result if the transaction was executed.
///
/// ---
///
/// ## List Consumable Notes
///
/// **`POST /api/v1/consumable-notes/list`** - Retrieves consumable notes' note-ids for an account.
///
/// ```bash
/// # Get consumable notes for a specific account
/// curl -X POST http://localhost:59059/api/v1/consumable-notes/list \
///   -H "Content-Type: application/json" \
///   -d '{
///     "address": "mtst1xyz..."
///   }'
///
/// # Get all consumable notes (across all accounts)
/// curl -X POST http://localhost:59059/api/v1/consumable-notes/list \
///   -H "Content-Type: application/json" \
///   -d '{
///     "address": null
///   }'
/// ```
///
/// Response:
/// ```json
/// {
///   "note_ids": [
///     {
///       "note_id": "0xabc123...",
///       "note_id_file_bytes": "<base64_encoded_note_file>"
///     },
///     {
///       "note_id": "0xdef456...",
///       "note_id_file_bytes": "<base64_encoded_note_file>"
///     },
///     {
///       "note_id": "0x789ghi...",
///       "note_id_file_bytes": "<base64_encoded_note_file>"
///     }
///   ]
/// }
/// ```
///
/// ---
///
/// ## Get Multisig Account Details
///
/// **`POST /api/v1/multisig-account/details`** - Retrieves details of a multisig account.
///
/// ```bash
/// curl -X POST http://localhost:59059/api/v1/multisig-account/details \
///   -H "Content-Type: application/json" \
///   -d '{
///     "multisig_account_address": "mtst1xyz..."
///   }'
/// ```
///
/// Response:
/// ```json
/// {
///   "multisig_account": {
///     "address": "mtst1xyz...",
///     "kind": "public",
///     "threshold": 2,
///     "created_at": "2025-10-19T12:00:00Z",
///     "updated_at": "2025-10-19T12:00:00Z"
///   }
/// }
/// ```
///
/// ---
///
/// ## List Approvers
///
/// **`POST /api/v1/multisig-account/approver/list`** - Lists all approvers for a specific multisig account.
///
/// ```bash
/// curl -X POST http://localhost:59059/api/v1/multisig-account/approver/list \
///   -H "Content-Type: application/json" \
///   -d '{
///     "multisig_account_address": "mtst1xyz..."
///   }'
/// ```
///
/// Response:
/// ```json
/// {
///   "approvers": [
///     {
///       "address": "mtst1abc...",
///       "pub_key_commit": "<base64_encoded_public_key_1>"
///     },
///     {
///       "address": "mtst1def...",
///       "pub_key_commit": "<base64_encoded_public_key_2>"
///     },
///     {
///       "address": "mtst1ghi...",
///       "pub_key_commit": "<base64_encoded_public_key_3>"
///     }
///   ]
/// }
/// ```
///
/// ---
///
/// ## Get Transaction Statistics
///
/// **`POST /api/v1/multisig-tx/stats`** - Retrieves transaction statistics for a multisig account.
///
/// ```bash
/// curl -X POST http://localhost:59059/api/v1/multisig-tx/stats \
///   -H "Content-Type: application/json" \
///   -d '{
///     "multisig_account_address": "mtst1xyz..."
///   }'
/// ```
///
/// Response:
/// ```json
/// {
///   "tx_stats": {
///     "total": 42,
///     "last_month": 15,
///     "total_success": 38
///   }
/// }
/// ```
///
/// ---
///
/// ## List Transactions
///
/// **`POST /api/v1/multisig-tx/list`** - Lists all transactions for a multisig account,
/// optionally filtered by status.
///
/// ```bash
/// # List all transactions
/// curl -X POST http://localhost:59059/api/v1/multisig-tx/list \
///   -H "Content-Type: application/json" \
///   -d '{
///     "multisig_account_address": "mtst1xyz...",
///     "tx_status_filter": null
///   }'
///
/// # Filter by status (pending/success/failure)
/// curl -X POST http://localhost:59059/api/v1/multisig-tx/list \
///   -H "Content-Type: application/json" \
///   -d '{
///     "multisig_account_address": "mtst1xyz...",
///     "tx_status_filter": "pending"
///   }'
/// ```
///
/// Response:
/// ```json
/// {
///   "txs": [
///     {
///       "id": "550e8400-e29b-41d4-a716-446655440000",
///       "multisig_account_address": "mtst1xyz...",
///       "status": "pending",
///       "tx_request": "<base64_encoded_transaction_request>",
///       "tx_summary": "<base64_encoded_transaction_summary>",
///       "tx_summary_commit": "<base64_encoded_transaction_summary_commitment>",
///       "input_note_ids": [
///         {
///           "note_id": "0xabc123...",
///           "note_id_file_bytes": "<base64_encoded_note_file>"
///         }
///       ],
///       "signature_count": 1,
///       "created_at": "2025-10-19T12:00:00Z",
///       "updated_at": "2025-10-19T12:00:00Z"
///     }
///   ]
/// }
/// ```
///
/// Note: `signature_count` is omitted if zero.
pub fn create_router(app: App) -> Router {
    Router::new()
        .route("/health", routing::get(routes::health))
        .route(
            "/api/v1/multisig-account/create",
            routing::post(routes::create_multisig_account),
        )
        .route("/api/v1/multisig-tx/propose", routing::post(routes::propose_multisig_tx))
        .route("/api/v1/signature/add", routing::post(routes::add_signature))
        .route("/api/v1/consumable-notes/list", routing::post(routes::list_consumable_notes))
        .route(
            "/api/v1/multisig-account/details",
            routing::post(routes::get_multisig_account_details),
        )
        .route(
            "/api/v1/multisig-account/approver/list",
            routing::post(routes::list_multisig_approvers),
        )
        .route("/api/v1/multisig-tx/stats", routing::post(routes::get_multisig_tx_stats))
        .route("/api/v1/multisig-tx/list", routing::post(routes::list_multisig_tx))
        .with_state(app)
}

/// The main application state containing the multisig engine.
///
/// This struct is passed to all route handlers and provides access to the
/// core multisig functionality through the engine.
#[derive(Clone, Builder, Dissolve)]
pub struct App {
    /// The multisig engine instance that handles all multisig operations
    engine: Arc<MultisigEngine<Started>>,
}
