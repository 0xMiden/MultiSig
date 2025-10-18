use bon::Builder;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Builder, Serialize)]
pub struct CreateMultisigAccountResponsePayload {
    address: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Builder, Serialize)]
pub struct ProposeMultisigTxResponsePayload {
    tx_id: Uuid,
    tx_summary: Bytes,
}

#[derive(Debug, Builder, Serialize)]
pub struct AddSignatureResponsePayload {
    tx_result: Option<Bytes>,
}
