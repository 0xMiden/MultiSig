//! SQL queries for MultisigStore operations

// CONTRACT QUERIES
// ================================================================================================

/// Get contract metadata (threshold, type, created_at)
pub const GET_CONTRACT_METADATA: &str = 
    "SELECT threshold, type, EXTRACT(EPOCH FROM created_at)::BIGINT 
     FROM multi_sig_contracts 
     WHERE contract_id = $1";

/// Get approver addresses for a contract
pub const GET_CONTRACT_APPROVERS: &str = 
    "SELECT address 
     FROM contract_approvers 
     WHERE contract_id = $1";

// TRANSACTION QUERIES
// ================================================================================================

/// Get all transactions for a contract
pub const GET_CONTRACT_TRANSACTIONS_ALL: &str = 
    "SELECT tx.tx_id, tx.status, tx.transaction_effect, EXTRACT(EPOCH FROM tx.created_at)::BIGINT
     FROM contract_transactions tx 
     WHERE tx.contract_id = $1
     ORDER BY tx.created_at DESC";

/// Get transactions for a contract filtered by status
pub const GET_CONTRACT_TRANSACTIONS_BY_STATUS: &str = 
    "SELECT tx.tx_id, tx.status, tx.transaction_effect, EXTRACT(EPOCH FROM tx.created_at)::BIGINT
     FROM contract_transactions tx 
     WHERE tx.contract_id = $1 AND tx.status = $2
     ORDER BY tx.created_at DESC";

/// Get transaction by ID
pub const GET_TRANSACTION_BY_ID: &str = 
    "SELECT tx_id, contract_id, status, transaction_effect, EXTRACT(EPOCH FROM created_at)::BIGINT
     FROM contract_transactions 
     WHERE tx_id = $1";

/// Create a new transaction
pub const INSERT_TRANSACTION: &str = 
    "INSERT INTO contract_transactions (tx_id, contract_id, status, transaction_effect, created_at) 
     VALUES ($1, $2, $3, $4, TO_TIMESTAMP($5))";

/// Update transaction status
pub const UPDATE_TRANSACTION_STATUS: &str = 
    "UPDATE contract_transactions SET status = $1 WHERE tx_id = $2";

// SIGNATURE QUERIES
// ================================================================================================

/// Count signatures for a transaction
pub const COUNT_TRANSACTION_SIGNATURES: &str = 
    "SELECT COUNT(*) FROM transaction_signatures WHERE tx_id = $1";

/// Validate if signer is a valid approver for the transaction's contract
pub const VALIDATE_APPROVER_FOR_TRANSACTION: &str = 
    "SELECT 1 
     FROM contract_approvers ca 
     JOIN contract_transactions ct ON ct.contract_id = ca.contract_id 
     WHERE ct.tx_id = $1 AND ca.address = $2";

/// Insert a new signature
pub const INSERT_TRANSACTION_SIGNATURE: &str = 
    "INSERT INTO transaction_signatures (tx_id, address, signature, signed_at) 
     VALUES ($1, $2, $3, NOW())";

/// Get all signatures for a transaction
pub const GET_TRANSACTION_SIGNATURES: &str = 
    "SELECT tx_id, address, signature 
     FROM transaction_signatures 
     WHERE tx_id = $1
     ORDER BY signed_at ASC";

// CONTRACT MANAGEMENT QUERIES (Future use)
// ================================================================================================

/// Create a new multisig contract
pub const INSERT_CONTRACT: &str = 
    "INSERT INTO multi_sig_contracts (contract_id, threshold, type, created_at) 
     VALUES ($1, $2, $3, NOW())";

/// Add an approver to a contract
pub const INSERT_CONTRACT_APPROVER: &str = 
    "INSERT INTO contract_approvers (contract_id, address) VALUES ($1, $2)";

/// Add approver details
pub const INSERT_APPROVER_DETAILS: &str = 
    "INSERT INTO approver_details (address, public_key) 
     VALUES ($1, $2) 
     ON CONFLICT (address) DO UPDATE SET public_key = EXCLUDED.public_key"; 