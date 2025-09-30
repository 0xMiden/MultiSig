CREATE TABLE IF NOT EXISTS multisig_contract (
    id TEXT PRIMARY KEY,
    threshold INTEGER NOT NULL,
    kind TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approver (
    address TEXT PRIMARY KEY,
    public_key BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS contract_approver_mapping (
    contract_id TEXT NOT NULL REFERENCES multisig_contract(id) ON DELETE CASCADE,
    approver_address TEXT NOT NULL REFERENCES approver(address) ON DELETE CASCADE,
    approver_index INTEGER NOT NULL CHECK (approver_index >= 0),

    PRIMARY KEY (contract_id, approver_address),
    UNIQUE (contract_id, approver_index)
);

CREATE TABLE IF NOT EXISTS contract_tx (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES multisig_contract(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    tx_bz BYTEA NOT NULL,
    tx_summary BYTEA NOT NULL,
    tx_summary_commitment BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tx_sig (
    tx_id UUID NOT NULL REFERENCES contract_tx(id) ON DELETE CASCADE,
    approver_address TEXT NOT NULL REFERENCES approver(address) ON DELETE CASCADE,
    sig BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tx_id, approver_address)
);
