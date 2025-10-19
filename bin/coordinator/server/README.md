# server

HTTP REST API server for the multisig coordinator, powered by the multisig engine.

## architecture

The server is built with [axum](https://docs.rs/axum) and wraps the multisig engine to expose HTTP endpoints for multisig operations. All business logic is handled by the engine - the server layer simply handles HTTP request/response serialization and validation.

On startup, the server:

1. Establishes a PostgreSQL connection pool.
2. Creates and starts a `MultisigEngine` with a dedicated Miden runtime thread.
3. Wraps the engine in an `App` state accessible to all route handlers.
4. Binds to the configured TCP listener.

## configuration

Configuration is loaded from `base_config.ron` and can be overridden via environment variables with the prefix `MIDENMULTISIG_`.

### base configuration

```ron
Config(
    app: AppConfig(
        listen: "localhost:59059",
        network_id_hrp: "mtst",
    ),
    db: DbConfig(
        db_url: "postgres://multisig:multisig_password@localhost:5432/multisig",
        max_conn: 10,
    ),
    miden: MidenConfig(
        node_url: "https://rpc.testnet.miden.io:443",
        store_path: "./store",
        keystore_path: "./keystore",
        timeout: "30s",
    ),
)
```

### environment variable overrides

Use double underscores (`__`) to override nested configuration fields:

```bash
# override app config
export MIDENMULTISIG_APP__LISTEN="0.0.0.0:8080"
export MIDENMULTISIG_APP__NETWORK_ID_HRP="mtst"

# override database config
export MIDENMULTISIG_DB__DB_URL="postgres://user:pass@db-host:5432/multisig"
export MIDENMULTISIG_DB__MAX_CONN="20"

# override miden config
export MIDENMULTISIG_MIDEN__NODE_URL="https://rpc.testnet.miden.io:443"
export MIDENMULTISIG_MIDEN__STORE_PATH="./miden-store.sqlite3"
export MIDENMULTISIG_MIDEN__KEYSTORE_PATH="./keystore"
export MIDENMULTISIG_MIDEN__TIMEOUT="60s"
```

## running the server

```bash
# using cargo
cargo run --bin miden-multisig-coordinator-server --release
```

## http api

### health check

Check if the server is running.

```bash
curl -X GET http://localhost:59059/health
```

**Response:** `200 OK`

---

### create multisig account

Creates a new multisig account with specified approvers and threshold.

**Endpoint:** `POST /api/v1/multisig-account/create`

```bash
curl -X POST http://localhost:59059/api/v1/multisig-account/create \
  -H "Content-Type: application/json" \
  -d '{
    "threshold": 2,
    "approvers": [
      "mtst1abc...",
      "mtst1def...",
      "mtst1ghi..."
    ],
    "pub_key_commits": [
      "<base64_encoded_public_key_1>",
      "<base64_encoded_public_key_2>",
      "<base64_encoded_public_key_3>"
    ]
  }'
```

**Response:**

```json
{
  "address": "mtst1xyz...",
  "created_at": "2025-10-19T12:00:00Z",
  "updated_at": "2025-10-19T12:00:00Z"
}
```

---

### propose transaction

Proposes a new transaction for a multisig account.

**Endpoint:** `POST /api/v1/multisig-tx/propose`

```bash
curl -X POST http://localhost:59059/api/v1/multisig-tx/propose \
  -H "Content-Type: application/json" \
  -d '{
    "multisig_account_address": "mtst1xyz...",
    "tx_request": "<base64_encoded_transaction_request>"
  }'
```

**Response:**

```json
{
  "tx_id": "550e8400-e29b-41d4-a716-446655440000",
  "tx_summary": "<base64_encoded_transaction_summary>"
}
```

---

### add signature

Submits an approver's signature for a pending transaction. If the signature threshold is met, the transaction is automatically processed.

**Endpoint:** `POST /api/v1/signature/add`

```bash
curl -X POST http://localhost:59059/api/v1/signature/add \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "550e8400-e29b-41d4-a716-446655440000",
    "approver": "mtst1abc...",
    "signature": "<base64_encoded_signature>"
  }'
```

**Response:**

```json
{
  "tx_result": "<base64_encoded_transaction_result_if_threshold_met>"
}
```

Note: `tx_result` is either `null` if threshold is not yet met, or contains the base64-encoded transaction result if the transaction was executed.

---

### get multisig account details

Retrieves details of a multisig account.

**Endpoint:** `POST /api/v1/multisig-account/details`

```bash
curl -X POST http://localhost:59059/api/v1/multisig-account/details \
  -H "Content-Type: application/json" \
  -d '{
    "multisig_account_address": "mtst1xyz..."
  }'
```

**Response:**

```json
{
  "multisig_account": {
    "address": "mtst1xyz...",
    "kind": "public",
    "threshold": 2,
    "created_at": "2025-10-19T12:00:00Z",
    "updated_at": "2025-10-19T12:00:00Z"
  }
}
```

---

### list transactions

Lists all transactions for a multisig account, optionally filtered by status.

**Endpoint:** `POST /api/v1/multisig-tx/list`

```bash
# list all transactions
curl -X POST http://localhost:59059/api/v1/multisig-tx/list \
  -H "Content-Type: application/json" \
  -d '{
    "multisig_account_address": "mtst1xyz...",
    "tx_status_filter": null
  }'

# filter by status (pending/success/failure)
curl -X POST http://localhost:59059/api/v1/multisig-tx/list \
  -H "Content-Type: application/json" \
  -d '{
    "multisig_account_address": "mtst1xyz...",
    "tx_status_filter": "pending"
  }'
```

**Response:**

```json
{
  "txs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "multisig_account_address": "mtst1xyz...",
      "status": "pending",
      "tx_request": "<base64_encoded_transaction_request>",
      "tx_summary": "<base64_encoded_transaction_summary>",
      "tx_summary_commit": "<base64_encoded_transaction_summary_commitment>",
      "signature_count": 1,
      "created_at": "2025-10-19T12:00:00Z",
      "updated_at": "2025-10-19T12:00:00Z"
    }
  ]
}
```

Note: `signature_count` is omitted if zero.
