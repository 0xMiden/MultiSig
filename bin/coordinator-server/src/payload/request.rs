use core::num::NonZeroU32;

use bytes::Bytes;
use dissolve_derive::Dissolve;
use serde::Deserialize;
use uuid::Uuid;

#[derive(Debug, Dissolve, Deserialize)]
pub struct CreateMultisigAccountRequestPayload {
    threshold: NonZeroU32,
    approvers: Vec<String>,
    pub_key_commits: Vec<Bytes>,
}

#[derive(Debug, Dissolve, Deserialize)]
pub struct ProposeMultisigTxRequestPayload {
    multisig_account_address: String,
    tx_request: Bytes,
}

#[derive(Debug, Dissolve, Deserialize)]
pub struct AddSignatureRequestPayload {
    tx_id: Uuid,
    approver: String,
    signature: Bytes,
}

#[derive(Debug, Dissolve, Deserialize)]
pub struct ListConsumableNotesRequestPayload {
    address: Option<String>,
}

#[derive(Debug, Dissolve, Deserialize)]
pub struct GetMultisigAccountDetailsRequestPayload {
    multisig_account_address: String,
}

#[derive(Debug, Dissolve, Deserialize)]
pub struct ListMultisigApproverRequestPayload {
    multisig_account_address: String,
}

#[derive(Debug, Dissolve, Deserialize)]
pub struct ListMultisigTxRequestPayload {
    multisig_account_address: String,
    tx_status_filter: Option<String>,
}
