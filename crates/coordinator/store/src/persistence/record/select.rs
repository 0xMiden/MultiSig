use chrono::{DateTime, Utc};
use diesel::prelude::Queryable;
use dissolve_derive::Dissolve;
use uuid::Uuid;

use crate::persistence::record::{AccountKind, TxStatus};

#[derive(Debug, Dissolve, Queryable)]
pub struct MultisigAccountRecord {
    address: String,
    kind: AccountKind,
    threshold: i64,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Dissolve, Queryable)]
pub struct ApproverRecord {
    address: String,
    pub_key_commit: Vec<u8>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Dissolve, Queryable)]
pub struct TxRecord {
    id: Uuid,
    multisig_account_address: String,
    status: TxStatus,
    tx_request: Vec<u8>,
    tx_summary: Vec<u8>,
    tx_summary_commit: Vec<u8>,
    created_at: DateTime<Utc>,
}
