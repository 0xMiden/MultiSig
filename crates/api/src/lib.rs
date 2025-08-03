use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};

use multisig_store::{MultisigStore, StoreError};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, os::unix::net::SocketAddr, sync::Arc};
use tower_http::cors::CorsLayer;
use tracing::{error, info};

// API Response Types
// ================================================================================================

#[derive(Debug, Serialize)]
pub struct AccountInfoResponse {
    #[serde(rename = "APPROVER_NUMBER")]
    pub approver_number: usize,
    #[serde(rename = "TYPE")]
    pub r#type: String,
    #[serde(rename = "THRESHOLD")]
    pub threshold: i32,
    #[serde(rename = "APPROVER")]
    pub approver: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct TransactionItem {
    #[serde(rename = "STATUS")]
    pub status: String,
    #[serde(rename = "SIGNATURE_NUMBER")]
    pub signature_number: i64,
    #[serde(rename = "TRANSACTION_DATA_BYTES")]
    pub transaction_data_bytes: String,
}

#[derive(Debug, Serialize)]
pub struct TransactionsResponse {
    #[serde(rename = "TRANSACTIONS")]
    pub transactions: Vec<TransactionItem>,
}

#[derive(Debug, Serialize)]
pub struct TransactionByHashResponse {
    #[serde(rename = "TRANSACTION_DATA_BYTES")]
    pub transaction_data_bytes: String,
}

// API Request Types
// ================================================================================================

#[derive(Debug, Deserialize)]
pub struct CreateTransactionRequest {
    #[serde(rename = "TRANSACTION_SUMMARY_HASH")]
    pub transaction_summary_hash: String,
    #[serde(rename = "TRANSACTION_DATA_BYTES")]
    pub transaction_data_bytes: String,
}

#[derive(Debug, Deserialize)]
pub struct AddSignatureRequest {
    #[serde(rename = "APPROVER_ADDRESS")]
    pub approver_address: String,
    #[serde(rename = "SIGNATURE")]
    pub signature: String,
}

#[derive(Debug, Deserialize)]
pub struct TransactionQuery {
    #[serde(rename = "STATUS")]
    pub status: Option<String>,
}

// API Error Response
// ================================================================================================

#[derive(Debug, Serialize)]
pub enum APIError {
    AccountNotFound,
    TransactionNotFound,
    StateNotFound,
}

impl IntoResponse for APIError {
    fn into_response(self) -> Response {
        match self {
            APIError::AccountNotFound => (StatusCode::NOT_FOUND, Json(self)).into_response(),
            APIError::TransactionNotFound => (StatusCode::NOT_FOUND, Json(self)).into_response(),
            APIError::StateNotFound => (StatusCode::NOT_FOUND, Json(self)).into_response(),
        }
    }
}

// API Handlers
// ================================================================================================

/// GET /api/v1/accounts/{account_id}
pub async fn get_account_info(
    State(store): State<Arc<MultisigStore>>,
    Path(account_id): Path<String>,
) -> Result<Json<AccountInfoResponse>, APIError> {
    info!("Getting account info for: {}", account_id);

    let contract_info = store
        .get_contract_info(&account_id)
        .await
        .map_err(|e| APIError::AccountNotFound)?;

    match contract_info {
        Some(info) => {
            let response = AccountInfoResponse {
                approver_number: info.approvers.len(),
                r#type: info.contract_type,
                threshold: info.threshold,
                approver: info.approvers,
            };
            Ok(Json(response))
        }
        None => Err(APIError::AccountNotFound),
    }
}

/// GET /api/v1/accounts/{account_id}/transactions
pub async fn get_account_transactions(
    State(store): State<Arc<MultisigStore>>,
    Path(account_id): Path<String>,
    Query(params): Query<TransactionQuery>,
) -> Result<Json<TransactionsResponse>, APIError> {
    info!("Getting transactions for account: {}", account_id);

    let status_filter = params.status.as_deref();
    let transactions = store
        .get_contract_transactions(&account_id, status_filter)
        .await
        .map_err(|e| APIError::TransactionNotFound)?;

    let transaction_items: Vec<TransactionItem> = transactions
        .into_iter()
        .map(|tx| TransactionItem {
            status: tx.status,
            signature_number: tx.signature_count.unwrap_or(0),
            transaction_data_bytes: tx.transaction_effect,
        })
        .collect();

    let response = TransactionsResponse {
        transactions: transaction_items,
    };

    Ok(Json(response))
}

/// GET /api/v1/transactions/{tx_id}
pub async fn get_transaction_by_hash(
    State(store): State<Arc<MultisigStore>>,
    Path(tx_id): Path<String>,
) -> Result<Json<TransactionByHashResponse>, APIError> {
    info!("Getting transaction by hash: {}", tx_id);

    let transaction = store
        .get_transaction_by_id(&tx_id)
        .await
        .map_err(|e| APIError::TransactionNotFound)?;

    match transaction {
        Some(tx) => {
            let response = TransactionByHashResponse {
                transaction_data_bytes: tx.transaction_effect,
            };
            Ok(Json(response))
        }
        None => Err(APIError::TransactionNotFound),
    }
}

/// POST /api/v1/accounts/{account_id}/transactions
pub async fn create_transaction(
    State(store): State<Arc<MultisigStore>>,
    Path(account_id): Path<String>,
    Json(payload): Json<CreateTransactionRequest>,
) -> Result<StatusCode, APIError> {
    info!("Creating transaction for account: {}", account_id);

    // Verify the account exists
    let contract_info = store
        .get_contract_info(&account_id)
        .await
        .map_err(|e| APIError::AccountNotFound)?;
    if contract_info.is_none() {
        return Err(APIError::AccountNotFound);
    }

    // Create the transaction using the hash as tx_id
    store
        .create_transaction(
            &payload.transaction_summary_hash,
            &account_id,
            &payload.transaction_data_bytes,
        )
        .await
        .map_err(|e| APIError::StateNotFound)?;

    Ok(StatusCode::CREATED)
}

/// POST /api/v1/transactions/{tx_id}/signatures
pub async fn add_signature(
    State(store): State<Arc<MultisigStore>>,
    Path(tx_id): Path<String>,
    Json(payload): Json<AddSignatureRequest>,
) -> Result<StatusCode, APIError> {
    info!("Adding signature to transaction: {}", tx_id);

    // Verify the transaction exists
    let transaction = store
        .get_transaction_by_id(&tx_id)
        .await
        .map_err(|e| APIError::TransactionNotFound)?;
    if transaction.is_none() {
        return Err(APIError::TransactionNotFound);
    }

    // Add the signature
    let success = store
        .add_transaction_signature(&tx_id, &payload.approver_address, &payload.signature)
        .await
        .map_err(|e| APIError::StateNotFound)?;

    if success {
        Ok(StatusCode::OK)
    } else {
        Err(APIError::StateNotFound)
    }
}

// Router Setup
// ================================================================================================

pub fn create_router(store: Arc<MultisigStore>) -> Router {
    Router::new()
        .route("/api/v1/accounts/:account_id", get(get_account_info))
        .route(
            "/api/v1/accounts/:account_id/transactions",
            get(get_account_transactions).post(create_transaction),
        )
        .route("/api/v1/transactions/:tx_id", get(get_transaction_by_hash))
        .route(
            "/api/v1/transactions/:tx_id/signatures",
            post(add_signature),
        )
        .layer(CorsLayer::permissive())
        .with_state(store)
}

// Server Setup
// ================================================================================================

pub async fn start_server(
    database_url: &str,
    bind_address: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    info!("Initializing MultisigStore with database: {}", database_url);

    // Initialize the store
    let store = MultisigStore::new(database_url)
        .await
        .map_err(|e| format!("Failed to initialize store: {}", e))?;

    info!("MultisigStore initialized successfully");

    // Create the router
    let app = create_router(Arc::new(store));

    info!("Starting server on {}", bind_address);

    // Use the bind_address parameter instead of hardcoded address
    let listener = tokio::net::TcpListener::bind(bind_address).await?;
    println!("🚀 Listening on http://{}", bind_address);

    // Modern Axum 0.7+ syntax - no Hyper Server needed
    axum::serve(listener, app).await?;

    Ok(())
}
