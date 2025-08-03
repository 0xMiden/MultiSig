CREATE TABLE IF NOT EXISTS multisig_contract (
    contract_id TEXT PRIMARY KEY,
    threshold INTEGER NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approver (
    address TEXT PRIMARY KEY,
    public_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contract_approvers (
    contract_id TEXT NOT NULL REFERENCES multisig_contract(contract_id) ON DELETE CASCADE,
    address TEXT NOT NULL REFERENCES approver(address) ON DELETE CASCADE,
    
    PRIMARY KEY (contract_id, address)
);

CREATE TABLE IF NOT EXISTS contract_tx (
    tx_id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES multisig_contract(contract_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    effect TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tx_sigs (
    tx_id TEXT NOT NULL REFERENCES contract_tx(tx_id) ON DELETE CASCADE,
    address TEXT NOT NULL REFERENCES approver(address) ON DELETE CASCADE,
    sig TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tx_id, address)
);
