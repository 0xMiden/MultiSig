use chrono::{DateTime, Utc};
use diesel::prelude::Queryable;
use dissolve_derive::Dissolve;
use uuid::Uuid;

#[derive(Debug, Dissolve, Queryable)]
pub struct ContractTxRecord {
    tx_id: Uuid,
    contract_id: String,
    status: String,
    tx_bz: Vec<u8>,
    tx_summary: Vec<u8>,
    tx_summary_commitment: Vec<u8>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Dissolve, Queryable)]
pub struct TxSigRecord {
    tx_id: Uuid,
    approver_address: String,
    sig: Vec<u8>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Dissolve, Queryable)]
pub struct MultisigContractRecord {
    contract_id: String,
    threshold: i32,
    kind: String,
    created_at: DateTime<Utc>,
}
