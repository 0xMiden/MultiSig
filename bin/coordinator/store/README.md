# MultisigStore

A PostgreSQL-based storage layer for multisig account operations.

## Setup

### 1. Environment Variables

Install [diesel-cli](https://diesel.rs/guides/getting-started#installing-diesel-cli) and set environment variable of your database URL:

```bash
export DATABASE_URL="postgres://username:password@localhost/multisig"
```

### 2. Database Setup

First, ensure you have PostgreSQL running and create a database:

```bash
diesel migration run
```

### 3. Dependencies

Add to your `Cargo.toml`:

```toml
[dependencies]
multisig-store = { path = "../crates/multisig-store" }
tokio = { version = "1.0", features = ["full"] }
```

## Usage

### Basic Setup

```rust
use multisig_store::MultisigStore;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = "postgres://username:password@localhost/multisig";

    let db_pool =
		    miden_multisig_store::establish_pool(&database_url, NonZeroUsize::new(10).unwrap())
			    .await
			    .map_err(|e| format!("Failed to create database pool: {}", e))?;

    let store = MultisigStore::new(database_url).await?;
    
    // Your multisig operations here...
    
    Ok(())
}
```

### Operations

#### 1. Create a Contract

```rust
    // Create a 2-of-3 multisig contract
    store.create_contract("contract_123", 2, "multisig").await?;

    // Add approvers
    store.add_contract_approver(
        "contract_123", 
        "0x1234...", 
        "public_key_data"
    ).await?;
```

#### 2. Create Transaction

```rust
    store.create_transaction(
        "tx_456",
        "contract_123", 
        "send 100 tokens to 0xabcd..."
    ).await?;
```

#### 3. Add Signatures

```rust
    let success = store.add_transaction_signature(
        "tx_456",
        "0x1234...",  // approver address
        "signature_data"
    ).await?;

    if success {
        println!("Signature added successfully");
    } else {
        println!("Invalid approver");
    }
```

#### 4. Query Operations

```rust
    // Get contract info
    if let Some(contract) = store.get_contract_info("contract_123").await? {
        println!("Threshold: {}", contract.threshold);
        println!("Approvers: {:?}", contract.approvers);
    }

    // Get transactions
    let transactions = store.get_contract_transactions("contract_123", None).await?;
    for tx in transactions {
        println!("TX: {} - Status: {} - Signatures: {:?}", 
                 tx.tx_id, tx.status, tx.signature_count);
    }

    // Get specific transaction
    if let Some(tx) = store.get_transaction_by_id("tx_456").await? {
        println!("Transaction details: {:?}", tx);
    }
```

#### 5. Update Transaction Status

```rust
    // Update from pending to confirmed
    store.update_transaction_status("tx_456", "CONFIRMED").await?;
```

## Schema

For the schema, refer to `./migrations` directory.
