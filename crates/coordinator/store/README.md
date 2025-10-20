# store

Persistence layer for multisig coordinator using PostgreSQL and [Diesel ORM](diesel.rs).

## establishing connection pool

```rust
use core::num::NonZeroUsize;

let pool = miden_multisig_coordinator_store::establish_pool("postgresql://localhost/multisig", 10.try_into()?).await?;

let store = MultisigStore::new(pool);
```

## usage examples

### create multisig account

```rust
use miden_multisig_coordinator_domain::account::MultisigAccount;

let account = MultisigAccount::builder()
    .address(account_id_address)
    .network_id(network_id)
    .kind(AccountStorageMode::Public)
    .threshold(NonZeroU32::new(2).unwrap())
    .aux(())
    .build()
    .with_approvers(approver_addresses)?
    .with_pub_key_commits(pub_key_commits)?;

let created_account = store.create_multisig_account(account).await?;
```

### create transaction

```rust
let tx_id = store.create_multisig_tx(
    network_id,
    account_address,
    &tx_request,
    &tx_summary,
).await?;
```

### add signature to transaction

```rust
let threshold_met = store.add_multisig_tx_signature(
    &tx_id,
    network_id,
    approver_address,
    &signature,
).await?;
```

### get multisig account

```rust
let account = store.get_multisig_account(network_id, account_address).await?;
```

### get transactions by account with status filter

```rust
use miden_multisig_coordinator_domain::tx::MultisigTxStatus;

// with status filter
let pending_txs = store.get_txs_by_multisig_account_address_with_status_filter(
    network_id,
    account_address,
    MultisigTxStatus::Pending,
).await?;

// without filter (all transactions)
let all_txs = store.get_txs_by_multisig_account_address_with_status_filter(
    network_id,
    account_address,
    None,
).await?;
```

### get transaction by id

```rust
let tx = store.get_multisig_tx_by_id(&tx_id).await?;
```

### get signatures with transaction

```rust
let (signatures, tx) = store.get_signatures_of_all_approvers_with_multisig_tx_by_tx_id(&tx_id).await?;
```

### update transaction status

```rust
store.update_multisig_tx_status_by_id(&tx_id, MultisigTxStatus::Success).await?;
```
