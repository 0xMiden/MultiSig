//! Configuration management for the multisig coordinator server.
//!
//! This module provides configuration loading from both base configuration file
//! and environment variables. Environment variables override the base configuration
//! and use the prefix `MIDENMULTISIG_`.

use core::{num::NonZeroUsize, time::Duration};

use config::{ConfigError, Environment, File, FileFormat};
use serde::Deserialize;

/// Loads the application configuration from base config and environment variables.
///
/// Environment variables use double underscores `__` to denote nested keys.
/// For example, `MIDENMULTISIG_APP__LISTEN` corresponds to `app.listen`.
///
/// # Errors
///
/// If the configuration could not be loaded or parsed
pub fn get_configuration() -> Result<Config, ConfigError> {
    config::Config::builder()
        .add_source(File::from_str(include_str!("base_config.ron"), FileFormat::Ron))
        .add_source(
            Environment::with_prefix(Config::CONFIG_ENV_PREFIX)
                .prefix_separator("_")
                .separator("__"),
        )
        .build()?
        .try_deserialize()
}

/// Root configuration structure containing all application settings.
#[derive(Deserialize)]
pub struct Config {
    /// Application-specific configuration
    pub app: AppConfig,

    /// Database configuration
    pub db: DbConfig,

    /// Node and multisig client runtime configuration
    pub miden: MidenConfig,
}

/// Application-specific configuration settings.
#[derive(Deserialize)]
pub struct AppConfig {
    /// The address to listen on (e.g., "0.0.0.0:59059")
    pub listen: String,

    /// The human-readable part (HRP) for network IDs in bech32 addresses (e.g., "mtst")
    pub network_id_hrp: String,

    /// CORS allowed origins (e.g., ["http://localhost:3000", "https://example.com"])
    /// Use ["*"] to allow all origins
    pub cors_allowed_origins: Vec<String>,
}

/// Database configuration settings.
#[derive(Deserialize)]
pub struct DbConfig {
    /// The database connection URL
    pub db_url: String,

    /// Maximum number of database connections in the pool
    pub max_conn: NonZeroUsize,
}

/// Node and multisig client runtime configuration settings.
#[derive(Deserialize)]
pub struct MidenConfig {
    /// The URL of the node to connect to
    pub node_url: String,

    /// Path to the local store directory
    pub store_path: String,

    /// Path to the keystore directory
    pub keystore_path: String,

    /// Request timeout duration
    #[serde(with = "humantime_serde")]
    pub timeout: Duration,
}

impl Config {
    const CONFIG_ENV_PREFIX: &str = "MIDENMULTISIG";
}
