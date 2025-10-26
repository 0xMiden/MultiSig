use bon::Builder;
use chrono::{DateTime, Utc};
use miden_multisig_coordinator_domain::tx::MultisigTxStats;
use serde::Serialize;
use serde_with::base64::Base64;
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

#[serde_with::serde_as]
#[derive(Debug, Builder, Serialize)]
pub struct ProposeMultisigTxResponsePayload {
    tx_id: Uuid,

    #[serde_as(as = "Base64")]
    tx_summary: Vec<u8>,
}

#[serde_with::serde_as]
#[derive(Debug, Builder, Serialize)]
pub struct AddSignatureResponsePayload {
    #[serde_as(as = "Option<Base64>")]
    tx_result: Option<Vec<u8>>,
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
pub struct GetMultisigTxStatsResponsePayload {
    tx_stats: MultisigTxStats,
}

#[derive(Debug, Builder, Serialize)]
pub struct ListMultisigTxResponsePayload {
    txs: Vec<MultisigTxPayload>,
}
