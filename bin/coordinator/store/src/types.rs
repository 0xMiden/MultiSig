use core::num::NonZeroU64;

use bon::Builder;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use dissolve_derive::Dissolve;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Builder, Dissolve, Serialize, Deserialize)]
pub struct ContractInfo {
    contract_id: String,
    threshold: u32,
    kind: String,
    created_at: DateTime<Utc>,
    approvers: Vec<String>,
}

#[derive(Debug, Clone, Builder, Dissolve, Serialize, Deserialize)]
pub struct TransactionInfo {
    tx_id: Uuid,
    contract_id: String,
    status: String,
    tx_bz: Bytes,
    tx_summary: Bytes,
    tx_summary_commitment: Bytes,
    created_at: DateTime<Utc>,

    #[serde(skip_serializing_if = "Option::is_none")]
    sigs_count: Option<NonZeroU64>,
}

#[derive(Debug, Clone, Builder, Dissolve, Serialize, Deserialize)]
pub struct SignatureRecord {
    tx_id: Uuid,
    approver_address: String,
    sig: Bytes,
}

#[derive(Debug, Clone, Builder, Dissolve, Serialize, Deserialize)]
pub struct TransactionThresholdInfo {
    tx_id: Uuid,
    contract_id: String,
    status: String,
    tx_summary: Bytes,
    threshold: u32,
    sigs_count: u32,
    threshold_met: bool,
    created_at: DateTime<Utc>,
}
