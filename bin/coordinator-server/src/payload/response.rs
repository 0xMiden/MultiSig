use bon::Builder;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::payload::{
    MultisigAccountPayload, MultisigApproverPayload, MultisigTxPayload, NoteIdPayload,
};

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

#[derive(Debug, Builder, Serialize)]
pub struct ListConsumableNotesResponsePayload {
    note_ids: Vec<NoteIdPayload>,
}

#[derive(Debug, Builder, Serialize)]
pub struct GetMultisigAccountDetailsResponsePayload {
    multisig_account: MultisigAccountPayload,
}

#[derive(Debug, Builder, Serialize)]
pub struct ListMultisigApproverResponsePayload {
    approvers: Vec<MultisigApproverPayload>,
}

#[derive(Debug, Builder, Serialize)]
pub struct ListMultisigTxResponsePayload {
    txs: Vec<MultisigTxPayload>,
}
