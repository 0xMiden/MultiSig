-- PostgreSQL Schema for MultiSig Store
-- ================================

-- Table: multi_sig_contracts
CREATE TABLE IF NOT EXISTS multi_sig_contracts (
    contract_id TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (contract_id)
);

-- Table: approver_details
CREATE TABLE IF NOT EXISTS approver_details (
    address TEXT NOT NULL,
    public_key TEXT NOT NULL,
    
    PRIMARY KEY (address)
);

-- Table: contract_approvers
CREATE TABLE IF NOT EXISTS contract_approvers (
    contract_id TEXT NOT NULL,
    address TEXT NOT NULL,
    
    PRIMARY KEY (contract_id, address),
    FOREIGN KEY (contract_id) REFERENCES multi_sig_contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (address) REFERENCES approver_details(address) ON DELETE CASCADE
);

-- Table: contract_transactions
CREATE TABLE IF NOT EXISTS contract_transactions (
    tx_id TEXT NOT NULL,
    contract_id TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    transaction_effect TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    PRIMARY KEY (tx_id),
    FOREIGN KEY (contract_id) REFERENCES multi_sig_contracts(contract_id) ON DELETE CASCADE
);

-- Table: transaction_signatures
CREATE TABLE IF NOT EXISTS transaction_signatures (
    tx_id TEXT NOT NULL,
    address TEXT NOT NULL,
    signature TEXT NOT NULL,
    signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tx_id, address),
    FOREIGN KEY (tx_id) REFERENCES contract_transactions(tx_id) ON DELETE CASCADE,
    FOREIGN KEY (address) REFERENCES approver_details(address) ON DELETE CASCADE
);

-- ====================
-- Indexes for Performance
-- ====================
CREATE INDEX IF NOT EXISTS idx_contract_transactions_contract_id ON contract_transactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_transactions_status ON contract_transactions(status);
CREATE INDEX IF NOT EXISTS idx_contract_transactions_created_at ON contract_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_signatures_tx_id ON transaction_signatures(tx_id);
CREATE INDEX IF NOT EXISTS idx_transaction_signatures_address ON transaction_signatures(address);
CREATE INDEX IF NOT EXISTS idx_contract_approvers_contract_id ON contract_approvers(contract_id);