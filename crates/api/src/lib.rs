use axum::{
    Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{get, post},
};

use miden_multisig_store::MultisigStore;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::{error, info};

mod miden_runtime;
use miden_runtime::{ApproverInfo, MidenRuntime, MidenRuntimeSender};

// API Response Types
// ================================================================================================

#[derive(Debug, Serialize)]
pub struct AccountInfoResponse {
    #[serde(rename = "APPROVER_NUMBER")]
    pub approver_number: usize,
    #[serde(rename = "TYPE")]
    pub r#type: String,
    #[serde(rename = "THRESHOLD")]
    pub threshold: u32,
    #[serde(rename = "APPROVER")]
    pub approver: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct TransactionItem {
    #[serde(rename = "STATUS")]
    pub status: String,
    #[serde(rename = "SIGNATURE_NUMBER")]
    pub signature_number: u64,
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

#[derive(Debug, Serialize)]
pub struct CreateMultiSigAccountResponse {
    #[serde(rename = "MULTISIG_ACCOUNT_ADDRESS")]
    pub multisig_account_address: String,
}

#[derive(Debug, Serialize)]
pub struct CreateTransactionResponse {}

#[derive(Debug, Serialize)]
pub struct TransactionThresholdResponse {
    #[serde(rename = "TX_ID")]
    pub tx_id: String,
    #[serde(rename = "CONTRACT_ID")]
    pub contract_id: String,
    #[serde(rename = "STATUS")]
    pub status: String,
    #[serde(rename = "THRESHOLD")]
    pub threshold: u32,
    #[serde(rename = "SIGNATURE_COUNT")]
    pub signature_count: u32,
    #[serde(rename = "THRESHOLD_MET")]
    pub threshold_met: bool,
}

// API Request Types
// ================================================================================================

#[derive(Debug, Deserialize)]
pub struct CreateTransactionRequest {
    #[serde(rename = "TX_ID")]
    pub tx_id: String,
    #[serde(rename = "CONTRACT_ID")]
    pub contract_id: String,
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

#[derive(Debug, Deserialize)]
pub struct CreateMultiSigAccountRequest {
    #[serde(rename = "THRESHOLD")]
    pub threshold: u32,
    #[serde(rename = "TOTAL_APPROVERS")]
    pub total_approvers: u32,
    #[serde(rename = "APPROVER_LIST")]
    pub approver_list: Vec<ApproverInfo>,
}

// Application State
// ================================================================================================

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<MultisigStore>,
    pub miden_sender: MidenRuntimeSender,
}

// API Error Response
// ================================================================================================

#[derive(Debug, Serialize)]
pub enum APIError {
    AccountNotFound,
    TransactionNotFound,
    StateNotFound,
    InvalidInput,
    AccountCreationFailed,
    MidenError,
}

impl IntoResponse for APIError {
    fn into_response(self) -> Response {
        match self {
            APIError::AccountNotFound => (StatusCode::NOT_FOUND, Json(self)).into_response(),
            APIError::TransactionNotFound => (StatusCode::NOT_FOUND, Json(self)).into_response(),
            APIError::StateNotFound => (StatusCode::NOT_FOUND, Json(self)).into_response(),
            APIError::InvalidInput => (StatusCode::BAD_REQUEST, Json(self)).into_response(),
            APIError::AccountCreationFailed => {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(self)).into_response()
            }
            APIError::MidenError => (StatusCode::INTERNAL_SERVER_ERROR, Json(self)).into_response(),
        }
    }
}

// API Handlers
// ================================================================================================

/// POST /api/v1/multisig-accounts
pub async fn create_multisig_account(
    State(app_state): State<AppState>,
    Json(payload): Json<CreateMultiSigAccountRequest>,
) -> Result<Json<CreateMultiSigAccountResponse>, APIError> {
    info!(
        "Creating multisig account with threshold: {}, total_approvers: {}",
        payload.threshold, payload.total_approvers
    );

    // Validate input
    if payload.threshold == 0 {
        error!("Invalid threshold: cannot be zero");
        return Err(APIError::InvalidInput);
    }

    if payload.threshold > payload.total_approvers {
        error!(
            "Invalid threshold: {} cannot be greater than total approvers: {}",
            payload.threshold, payload.total_approvers
        );
        return Err(APIError::InvalidInput);
    }

    if payload.approver_list.len() != payload.total_approvers as usize {
        error!(
            "Approver list length {} doesn't match total_approvers {}",
            payload.approver_list.len(),
            payload.total_approvers
        );
        return Err(APIError::InvalidInput);
    }

    // Validate approver addresses and public keys are not empty
    for (index, approver) in payload.approver_list.iter().enumerate() {
        if approver.address.trim().is_empty() {
            error!("Approver {} has empty address", index);
            return Err(APIError::InvalidInput);
        }
        if approver.public_key.trim().is_empty() {
            error!("Approver {} has empty public key", index);
            return Err(APIError::InvalidInput);
        }
    }

    // Create multisig account using miden client (running in separate runtime)
    let contract_id = app_state
        .miden_sender
        .create_multisig_account(payload.threshold, payload.approver_list.clone())
        .await
        .map_err(|e| {
            error!("Miden client error: {}", e);
            APIError::MidenError
        })?;

    // Store the contract in the database
    app_state
        .store
        .create_contract(
            &contract_id,
            payload.threshold as i32,
            "public",
            payload
                .approver_list
                .iter()
                .map(|a| a.address.as_str())
                .collect(),
            payload
                .approver_list
                .iter()
                .map(|a| a.public_key.as_str())
                .collect(),
        )
        .await
        .map_err(|_| {
            error!("Failed to create contract in database");
            APIError::AccountCreationFailed
        })?;

    info!("Successfully created multisig account: {}", contract_id);

    let response = CreateMultiSigAccountResponse {
        multisig_account_address: contract_id,
    };

    Ok(Json(response))
}

/// GET /api/v1/accounts/{account_id}
pub async fn get_account_info(
    State(app_state): State<AppState>,
    Path(account_id): Path<String>,
) -> Result<Json<AccountInfoResponse>, APIError> {
    info!("Getting account info for: {}", account_id);

    let contract_info = app_state
        .store
        .get_contract_info(&account_id)
        .await
        .map_err(|_| APIError::AccountNotFound)?;

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
    State(app_state): State<AppState>,
    Path(account_id): Path<String>,
    Query(params): Query<TransactionQuery>,
) -> Result<Json<TransactionsResponse>, APIError> {
    info!("Getting transactions for account: {}", account_id);

    let status_filter = params.status.as_deref();
    let transactions = app_state
        .store
        .get_contract_transactions(&account_id, status_filter)
        .await
        .map_err(|_| APIError::TransactionNotFound)?;

    let transaction_items: Vec<TransactionItem> = transactions
        .into_iter()
        .map(|tx| TransactionItem {
            status: tx.status,
            signature_number: tx.sigs_count.map(|c| c.get()).unwrap_or(0),
            transaction_data_bytes: tx.effect,
        })
        .collect();

    let response = TransactionsResponse {
        transactions: transaction_items,
    };

    Ok(Json(response))
}

/// GET /api/v1/transactions/{tx_id}
pub async fn get_transaction_by_hash(
    State(app_state): State<AppState>,
    Path(tx_id): Path<String>,
) -> Result<Json<TransactionByHashResponse>, APIError> {
    info!("Getting transaction by hash: {}", tx_id);

    let transaction = app_state
        .store
        .get_transaction_by_id(&tx_id)
        .await
        .map_err(|_| APIError::TransactionNotFound)?;

    match transaction {
        Some(tx) => {
            let response = TransactionByHashResponse {
                transaction_data_bytes: tx.effect,
            };
            Ok(Json(response))
        }
        None => Err(APIError::TransactionNotFound),
    }
}

/// POST /api/v1/accounts/{account_id}/transactions
pub async fn create_transaction(
    State(app_state): State<AppState>,
    Path(account_id): Path<String>,
    Json(payload): Json<CreateTransactionRequest>,
) -> Result<Json<CreateTransactionResponse>, APIError> {
    info!(
        "Creating and processing transaction for account: {}",
        account_id
    );

    // Verify the account exists
    let contract_info = app_state
        .store
        .get_contract_info(&account_id)
        .await
        .map_err(|_| APIError::AccountNotFound)?;
    if contract_info.is_none() {
        return Err(APIError::AccountNotFound);
    }

    // Create the transaction in database using the miden tx_hash as tx_id
    app_state
        .store
        .create_transaction(
            &payload.tx_id,
            &account_id,
            &payload.transaction_data_bytes,
            &payload.transaction_summary_hash,
        )
        .await
        .map_err(|_| APIError::StateNotFound)?;

    info!(
        "Successfully processed and stored transaction: {}",
        payload.tx_id
    );

    Ok(Json(CreateTransactionResponse {}))
}

/// POST /api/v1/transactions/{tx_id}/signatures
pub async fn add_signature(
    State(app_state): State<AppState>,
    Path(tx_id): Path<String>,
    Json(payload): Json<AddSignatureRequest>,
) -> Result<StatusCode, APIError> {
    info!("Adding signature to transaction: {}", tx_id);

    // Verify the transaction exists
    let transaction = app_state
        .store
        .get_transaction_by_id(&tx_id)
        .await
        .map_err(|_| APIError::TransactionNotFound)?;
    if transaction.is_none() {
        return Err(APIError::TransactionNotFound);
    }

    // Add the signature and check if threshold is met
    let (signature_added, threshold_met) = app_state
        .store
        .add_transaction_signature(&tx_id, &payload.approver_address, &payload.signature)
        .await
        .map_err(|_| APIError::StateNotFound)?;

    if signature_added {
        info!(
            "Successfully added signature from {} to transaction {}",
            payload.approver_address, tx_id
        );

        if threshold_met {
            info!(
                "🎉 Threshold met for transaction {}! Processing transaction...",
                tx_id
            );

            // Get transaction details to collect signatures for miden processing
            let signatures = app_state
                .store
                .get_transaction_signatures(&tx_id)
                .await
                .map_err(|_| APIError::StateNotFound)?;

            let signature_list: Vec<String> = signatures.into_iter().map(|s| s.sig).collect();

            // Get transaction details
            let tx_info = app_state
                .store
                .get_transaction_by_id(&tx_id)
                .await
                .map_err(|_| APIError::TransactionNotFound)?
                .ok_or(APIError::TransactionNotFound)?;

            // Process transaction via miden runtime
            match app_state
                .miden_sender
                .process_transaction(
                    tx_info.effect.clone(),
                    tx_info.contract_id.clone(),
                    signature_list,
                )
                .await
            {
                Ok(miden_tx_hash) => {
                    info!("✅ Miden processed transaction: {}", miden_tx_hash);

                    // Update transaction status to CONFIRMED
                    if let Err(e) = app_state
                        .store
                        .process_transaction_threshold_met(&tx_id)
                        .await
                    {
                        error!("Failed to update transaction status: {:?}", e);
                    } else {
                        info!("🔄 Transaction {} status updated to CONFIRMED", tx_id);
                    }
                }
                Err(e) => {
                    error!("❌ Miden failed to process transaction: {}", e);
                    // Still mark as confirmed in database since threshold was met
                    if let Err(e) = app_state
                        .store
                        .process_transaction_threshold_met(&tx_id)
                        .await
                    {
                        error!("Failed to update transaction status: {:?}", e);
                    }
                }
            }
        }

        Ok(StatusCode::OK)
    } else {
        Err(APIError::StateNotFound)
    }
}

/// GET /api/v1/transactions/{tx_id}/threshold
pub async fn get_transaction_threshold_status(
    State(app_state): State<AppState>,
    Path(tx_id): Path<String>,
) -> Result<Json<TransactionThresholdResponse>, APIError> {
    info!("Getting threshold status for transaction: {}", tx_id);

    let threshold_info = app_state
        .store
        .get_transaction_with_threshold_info(&tx_id)
        .await
        .map_err(|_| APIError::TransactionNotFound)?;

    match threshold_info {
        Some(info) => {
            let response = TransactionThresholdResponse {
                tx_id: info.tx_id,
                contract_id: info.contract_id,
                status: info.status,
                threshold: info.threshold,
                signature_count: info.signature_count,
                threshold_met: info.threshold_met,
            };
            Ok(Json(response))
        }
        None => Err(APIError::TransactionNotFound),
    }
}

// Router Setup
// ================================================================================================

pub fn create_router(app_state: AppState) -> Router {
    Router::new()
        .route("/api/v1/multisig-accounts", post(create_multisig_account))
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
        .route(
            "/api/v1/transactions/:tx_id/threshold",
            get(get_transaction_threshold_status),
        )
        .layer(CorsLayer::permissive())
        .with_state(app_state)
}

// Server Setup
// ================================================================================================

pub async fn start_server(
    store: Arc<MultisigStore>,
    bind_address: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    // Create and start the miden runtime with MPSC channels
    info!("🚀 Starting Miden Runtime...");
    let miden_runtime = MidenRuntime::new().await?;
    let miden_sender = miden_runtime.get_sender();

    // Create app state with both store and miden runtime sender
    let app_state = AppState {
        store,
        miden_sender,
    };

    // Create the router
    let app = create_router(app_state);

    info!("Starting HTTP server on {}", bind_address);

    // Use the bind_address parameter instead of hardcoded address
    let listener = tokio::net::TcpListener::bind(bind_address).await?;
    println!("🚀 Listening on http://{}", bind_address);

    // Start the HTTP server
    // Note: miden_runtime will continue running in the background
    let server_result = axum::serve(listener, app).await;

    // If server stops, shutdown the miden runtime
    info!("🛑 Shutting down Miden Runtime...");
    miden_runtime.shutdown().await?;

    server_result?;
    Ok(())
}
