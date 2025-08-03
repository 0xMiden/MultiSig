use api::start_server;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Database URL for SQLite (creates a file called multisig.db)
    let database_url = "sqlite://multisig.db";

    // Server bind address
    let bind_address = "0.0.0.0:3000";

    println!("🚀 Starting MultiSig API Server...");
    println!("📄 Database: {}", database_url);
    println!("🌐 Server will be available at: http://{}", bind_address);

    // Start the server
    start_server(database_url, bind_address).await?;

    Ok(())
}
