use core::num::NonZeroU32;

use dissolve_derive::Dissolve;
use serde::Deserialize;
use serde_with::base64::Base64;
use uuid::Uuid;

#[serde_with::serde_as]
#[derive(Debug, Dissolve, Deserialize)]
pub struct CreateMultisigAccountRequestPayload {
    threshold: NonZeroU32,
    approvers: Vec<String>,

    #[serde_as(as = "Vec<Base64>")]
    pub_key_commits: Vec<Vec<u8>>,
}

#[serde_with::serde_as]
#[derive(Debug, Dissolve, Deserialize)]
pub struct ProposeMultisigTxRequestPayload {
    multisig_account_address: String,

    #[serde_as(as = "Base64")]
    tx_request: Vec<u8>,
}

#[serde_with::serde_as]
#[derive(Debug, Dissolve, Deserialize)]
pub struct AddSignatureRequestPayload {
    tx_id: Uuid,
    approver: String,

    #[serde_as(as = "Base64")]
    signature: Vec<u8>,
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
pub struct GetMultisigTxStatsRequestPayload {
    multisig_account_address: String,
}

#[derive(Debug, Dissolve, Deserialize)]
pub struct ListMultisigTxRequestPayload {
    multisig_account_address: String,
    tx_status_filter: Option<String>,
}
