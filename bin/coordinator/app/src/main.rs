use core::num::NonZeroUsize;

use std::sync::Arc;

use miden_multisig_coordinator_store::MultisigStore;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
	println!("🚀 Starting MultiSig API Server with Miden Runtime...");

	// Database configuration - using PostgreSQL
	let database_url = std::env::var("DATABASE_URL")
		.unwrap_or_else(|_| "postgresql://myuser:mypassword@localhost/multisig".to_string());

	// Server bind address
	let bind_address = "0.0.0.0:3000";

	println!("📄 Database: {database_url}");
	println!("🌐 Server will be available at: http://{bind_address}");

	// Create database pool
	println!("🔧 Creating database connection pool...");
	let db_pool = miden_multisig_coordinator_store::establish_pool(
		&database_url,
		NonZeroUsize::new(10).unwrap(),
	)
	.await
	.map_err(|e| format!("Failed to create database pool: {}", e))?;

	// Create MultisigStore
	println!("🏪 Initializing MultisigStore...");
	let store = Arc::new(MultisigStore::new(db_pool).await);

	// Start the server with both miden runtime and database store
	println!("🚀 Starting server with Miden Runtime and Database Store...");
	miden_multisig_coordinator_api::start_server(store, bind_address).await?;

	Ok(())
}
