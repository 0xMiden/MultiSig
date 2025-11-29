# engine

Core orchestration layer for the multisig coordinator. The engine manages a Miden client running on a dedicated thread, coordinates communication via channels, and handles reads/writes to the PostgreSQL persistence layer.

## architecture

The engine uses a type-state pattern with two states:

- `MultisigEngine<Stopped>` - Initial state before the multisig client runtime is started
- `MultisigEngine<Started>` - Active state with a running Miden client on a dedicated thread

Communication with the multisig client runtime happens asynchronously using:

- **unbounded MPSC channel** - Sends requests from the engine to the multisig client runtime thread
- **oneshot channels** - Receive responses back from the multisig client runtime for each request

The engine coordinates operations between:

- **miden client** (account creation, transaction proposal/execution/submission)
- **multisig store** (persisting accounts, transactions, signatures)

## starting the engine

```rust
use std::time::Duration;

use miden_multisig_coordinator_engine::{MultisigEngine, MultisigClientRuntimeConfig};

// create engine in stopped state
let engine: MultisigEngine<Stopped> = MultisigEngine::new(network_id, store);

// configure multisig client runtime
let config = MultisigClientRuntimeConfig::builder()
    .node_url("https://rpc.testnet.miden.io:443".parse()?)
    .store_path("./store.sqlite3".into())
    .keystore_path("./keystore".into())
    .timeout(Duration::from_secs(30))
    .build();

// start the multisig client runtime on a dedicated thread
let rt = tokio::runtime::Builder::new_current_thread().enable_all().build()?;
let engine: MultisigEngine<Started> = engine.start_multisig_client_runtime(rt, config);
```

## usage examples

### create multisig account

```rust
use miden_multisig_coordinator_engine::request::CreateMultisigAccountRequest;

let request = CreateMultisigAccountRequest::builder()
    .threshold(2.try_into()?)
    .approvers(vec![approver1, approver2, approver3])
    .pub_key_commits(vec![pk1, pk2, pk3])
    .build()?;

let response = engine.create_multisig_account(request).await?;
let (miden_account, multisig_account) = response.dissolve();
```

### propose transaction

```rust
use miden_multisig_coordinator_engine::request::ProposeMultisigTxRequest;

let request = ProposeMultisigTxRequest::builder()
    .multisig_account_id(multisig_account_id)
    .tx_request(tx_request)
    .build();

let response = engine.propose_multisig_tx(request).await?;
let (tx_id, tx_summary) = response.dissolve();
```

### add signature

```rust
use miden_multisig_coordinator_engine::request::AddSignatureRequest;

let request = AddSignatureRequest::builder()
    .tx_id(tx_id)
    .approver(approver_account_id)
    .signature(signature)
    .build();

// returns Some(TransactionResult) when threshold is met and tx is processed
let maybe_result = engine.add_signature(request).await?;

if let Some(tx_result) = maybe_result {
    println!("transaction executed: {tx_result:?}");
}
```

### get multisig account

```rust
use miden_multisig_coordinator_engine::request::GetMultisigAccountRequest;

let request = GetMultisigAccountRequest::builder()
    .multisig_account_id(account_id)
    .build();

let response = engine.get_multisig_account(request).await?;
let maybe_account = response.dissolve();

if let Some(account) = maybe_account {
    println!("got account: {account:?}");
}
```

### list approvers

```rust
use miden_multisig_coordinator_engine::request::ListMultisigApproverRequest;

let request = ListMultisigApproverRequest::builder()
    .multisig_account_id(multisig_account_id)
    .build();

let response = engine.list_multisig_approvers(request).await?;
let approvers = response.dissolve();
```

### list transactions

```rust
use miden_multisig_coordinator_engine::request::ListMultisigTxRequest;
use miden_multisig_coordinator_domain::tx::MultisigTxStatus;

let request = ListMultisigTxRequest::builder()
    .multisig_account_id(account_id)
    .tx_status_filter(Some(MultisigTxStatus::Pending))
    .build();

let response = engine.list_multisig_tx(request).await?;
let txs = response.dissolve();
```

### get consumable notes

```rust
use miden_multisig_coordinator_engine::request::GetConsumableNotesRequest;

let request = GetConsumableNotesRequest::builder()
    .account_id(Some(account_id))
    .build();

let notes = engine.get_consumable_notes(request).await?;
```

### stopping the engine

```rust
// gracefully shutdown the multisig client runtime and return to stopped state
let stopped_engine = engine.stop_multisig_client_runtime().await?;
```

## workflow

1. **Create account** - Engine sends request to multisig client runtime to create account, then persists to database.
2. **Propose transaction** - Engine validates account exists, sends to multisig client runtime to generate transaction summary, stores in database with `Pending` status.
3. **Add signatures** - Engine validates approver, stores signature, checks if threshold is met.
4. **Process transaction** - When threshold is met, engine retrieves all signatures from the database, sends to multisig client runtime for execution, updates status in the database to `Success` or `Failure` depending on the transaction result.
