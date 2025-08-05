# MultiSig Store Setup Guide

The MultisigStore provides persistent storage for multisig contracts, transactions, and signatures using PostgreSQL.

## 🏗️ Database Schema

The store uses the following tables:

- **`multisig_contract`**: Stores multisig contract metadata (id, threshold, type)
- **`approver`**: Stores approver information (address, public_key)
- **`contract_approver_mapping`**: Maps approvers to contracts
- **`contract_tx`**: Stores transaction data and status
- **`tx_sig`**: Stores transaction signatures

## 🚀 Quick Setup

### 1. Install PostgreSQL

```bash
# On macOS
brew install postgresql
brew services start postgresql

# On Ubuntu
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create Database

```bash
# Create database
createdb multisig

# Or with custom user
sudo -u postgres createdb multisig
```

### 3. Set Environment Variable

```bash
export DATABASE_URL="postgresql://localhost/multisig"

# Or with credentials
export DATABASE_URL="postgresql://username:password@localhost/multisig"
```

### 4. Run Migrations

```bash
# Install diesel CLI if not already installed
cargo install diesel_cli --no-default-features --features postgres

# Run migrations
cd crates/store
diesel migration run
```

## 📊 Store Features

### ✅ Contract Management
- Create multisig contracts with threshold and type
- Add approvers to contracts
- Retrieve contract information and approver lists

### ✅ Transaction Management  
- Create pending transactions
- Retrieve transactions by ID or contract
- Filter transactions by status
- Update transaction status

### ✅ Signature Management
- Add signatures to transactions with validation
- Retrieve all signatures for a transaction
- Validate approver permissions

## 🔧 Usage Example

```rust
use std::sync::Arc;
use miden_multisig_store::{MultisigStore, persistence::pool::DatabasePool};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create database pool
    let database_url = "postgresql://localhost/multisig";
    let db_pool = DatabasePool::new(database_url).await?;
    
    // Create store
    let store = Arc::new(MultisigStore::new(db_pool).await);
    
    // Create a multisig contract
    store.create_contract("contract_123", 2, "multisig").await?;
    
    // Add approvers
    store.add_contract_approver(
        "contract_123", 
        "approver_address_1", 
        "public_key_1"
    ).await?;
    
    // Create a transaction
    store.create_transaction(
        "tx_456", 
        "contract_123", 
        "transfer 100 tokens"
    ).await?;
    
    // Add signature
    store.add_transaction_signature(
        "tx_456", 
        "approver_address_1", 
        "signature_data"
    ).await?;
    
    Ok(())
}
```

## 🔄 Integration with Miden Runtime

The store works seamlessly with the Miden runtime:

1. **Create Account**: Miden runtime generates account → Store saves contract details
2. **Process Transaction**: Miden runtime processes → Store tracks transaction status  
3. **Add Signatures**: API collects signatures → Store validates and saves
4. **Threshold Check**: Store can verify if enough signatures collected

## 🛠️ Configuration Options

### Pool Size
```rust
// Default pool size (10 connections)
let pool = DatabasePool::new(database_url).await?;

// Custom pool size
let pool = DatabasePool::new_with_size(database_url, 20).await?;
```

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `RUST_LOG`: Set to `debug` for detailed store operation logs

## 🧪 Testing

```bash
# Run store tests
cd crates/store
cargo test

# Run with database logging
RUST_LOG=debug cargo test
```

## 🔐 Security Considerations

- Store validates approver permissions before adding signatures
- Uses database transactions for atomic operations
- Supports PostgreSQL's built-in security features
- Connection pooling prevents connection exhaustion

## 📈 Performance

- Connection pooling for concurrent access
- Indexed primary keys for fast lookups
- Foreign key constraints maintain data integrity
- Optimized queries for common operations

## 🐛 Troubleshooting

### Connection Issues
```
Error: Failed to create database pool
```
- Check PostgreSQL is running: `brew services list | grep postgresql`
- Verify database exists: `psql -l`
- Check DATABASE_URL format

### Migration Issues  
```
Error: Could not run migrations
```
- Ensure diesel CLI is installed
- Check database permissions
- Verify migration files exist in `migrations/`

### Performance Issues
- Increase pool size for high concurrency
- Add database indexes for frequently queried columns
- Monitor connection usage with logging