# MultisigStore

A PostgreSQL-based storage layer for multisig wallet operations built with Rust and sqlx.

## Features

✅ **PostgreSQL Backend** - Production-ready database with ACID compliance  
✅ **Connection Pooling** - Efficient concurrent access via sqlx  
✅ **Async/Await** - Non-blocking database operations  
✅ **Type Safety** - Compile-time query validation  
✅ **Transaction Support** - Atomic operations for data consistency  

## Setup

### 1. Database Setup

First, ensure you have PostgreSQL running and create a database:

```bash
# Create database
createdb multisig

# Or using psql
psql -c "CREATE DATABASE multisig;"
```

### 2. Environment Variables

Set your database URL:

```bash
export DATABASE_URL="postgres://username:password@localhost/multisig"

# For testing
export TEST_DATABASE_URL="postgres://username:password@localhost/multisig_test"
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
    let store = MultisigStore::new(database_url).await?;
    
    // Your multisig operations here...
    
    Ok(())
}
```

### API Operations

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
store.update_transaction_status("tx_456", "confirmed").await?;
```

## Schema

The store automatically creates these tables:

- **`multi_sig_contracts`** - Contract metadata and thresholds
- **`approver_details`** - Approver addresses and public keys  
- **`contract_approvers`** - Links contracts to their approvers
- **`contract_transactions`** - Transaction records
- **`transaction_signatures`** - Signatures for each transaction

## Development

### Running Tests

```bash
# Set up test database
export TEST_DATABASE_URL="postgres://username:password@localhost/multisig_test"

# Run tests
cargo test
```

### Database Migrations

The store automatically applies migrations on startup. The schema is defined in `src/store.sql`.

## Production Considerations

1. **Connection Pooling**: The store uses sqlx's built-in connection pool
2. **Environment Variables**: Use proper database URLs in production
3. **Indexes**: The schema includes performance indexes
4. **Transactions**: Critical operations use database transactions
5. **Error Handling**: All database errors are properly wrapped

## Example Integration

```rust
use multisig_store::{MultisigStore, StoreError};

pub struct MultisigService {
    store: MultisigStore,
}

impl MultisigService {
    pub async fn new(database_url: &str) -> Result<Self, StoreError> {
        let store = MultisigStore::new(database_url).await?;
        Ok(Self { store })
    }
    
    pub async fn create_multisig_wallet(
        &self,
        contract_id: &str,
        threshold: i32,
        approvers: Vec<(String, String)>, // (address, public_key)
    ) -> Result<(), StoreError> {
        // Create contract
        self.store.create_contract(contract_id, threshold, "multisig").await?;
        
        // Add all approvers
        for (address, public_key) in approvers {
            self.store.add_contract_approver(contract_id, &address, &public_key).await?;
        }
        
        Ok(())
    }
}
```

This storage layer provides a robust foundation for building multisig wallet backends with PostgreSQL! 🚀 