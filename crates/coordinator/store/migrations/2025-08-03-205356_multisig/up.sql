-- enum variants ought to be in snake_case
CREATE TYPE account_kind AS ENUM ('private', 'public');
CREATE TYPE tx_status AS ENUM ('pending', 'success', 'failure');

CREATE TABLE IF NOT EXISTS multisig_account (
    -- bech32 account address
    address TEXT PRIMARY KEY,

    kind account_kind NOT NULL,
    threshold BIGINT NOT NULL CHECK (threshold > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approver (
    -- bech32 account address
    address TEXT PRIMARY KEY,

    pub_key_commit BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multisig_account_approver_mapping (
    -- bech32 account address
    multisig_account_address TEXT NOT NULL REFERENCES multisig_account(address) ON DELETE CASCADE,

    -- bech32 account address
    approver_address TEXT NOT NULL REFERENCES approver(address) ON DELETE CASCADE,

    approver_index BIGINT NOT NULL CHECK (approver_index >= 0),

    PRIMARY KEY (multisig_account_address, approver_address),
    UNIQUE (multisig_account_address, approver_index)
);

CREATE TABLE IF NOT EXISTS tx (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- bech32 account address
    multisig_account_address TEXT NOT NULL REFERENCES multisig_account(address) ON DELETE CASCADE,

    status tx_status NOT NULL DEFAULT 'pending',
    tx_request BYTEA NOT NULL,
    tx_summary BYTEA NOT NULL,
    tx_summary_commit BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signature (
    tx_id UUID NOT NULL REFERENCES tx(id) ON DELETE CASCADE,

    -- bech32 account address
    approver_address TEXT NOT NULL REFERENCES approver(address) ON DELETE CASCADE,

    signature_bytes BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tx_id, approver_address)
);
