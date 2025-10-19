use core::{num::NonZeroUsize, time::Duration};

use config::{ConfigError, Environment, File, FileFormat};
use serde::Deserialize;

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

#[derive(Deserialize)]
pub struct Config {
    pub app: AppConfig,
    pub db: DbConfig,
    pub miden: MidenConfig,
}

#[derive(Deserialize)]
pub struct AppConfig {
    pub listen: String,
    pub network_id_hrp: String,
}

#[derive(Deserialize)]
pub struct DbConfig {
    pub db_url: String,
    pub max_conn: NonZeroUsize,
}

#[derive(Deserialize)]
pub struct MidenConfig {
    pub node_url: String,
    pub store_path: String,
    pub keystore_path: String,

    #[serde(with = "humantime_serde")]
    pub timeout: Duration,
}

impl Config {
    const CONFIG_ENV_PREFIX: &str = "MIDENMULTISIG";
}
