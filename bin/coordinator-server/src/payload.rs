pub mod request;
pub mod response;

use core::num::NonZeroU32;

use bon::Builder;
use chrono::{DateTime, Utc};
use miden_client::{
    Word,
    note::{NoteFile, NoteId},
    utils::Serializable,
};
use miden_multisig_coordinator_domain::{
    account::{MultisigAccount, MultisigApprover, MultisigApproverDissolved},
    tx::{MultisigTx, MultisigTxDissolved, MultisigTxStatus},
};
use serde::Serialize;
use serde_with::{DisplayFromStr, base64::Base64};
use uuid::Uuid;

#[derive(Debug, Builder, Serialize)]
pub struct MultisigAccountPayload {
    address: String,
    kind: String,
    threshold: NonZeroU32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[serde_with::serde_as]
#[derive(Debug, Builder, Serialize)]
pub struct MultisigApproverPayload {
    address: String,

    #[serde_as(as = "Base64")]
    pub_key_commit: Vec<u8>,

    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[serde_with::serde_as]
#[derive(Debug, Builder, Serialize)]
pub struct MultisigTxPayload {
    id: Uuid,
    multisig_account_address: String,

    #[serde_as(as = "DisplayFromStr")]
    status: MultisigTxStatus,

    #[serde_as(as = "Base64")]
    tx_request: Vec<u8>,

    #[serde_as(as = "Base64")]
    tx_summary: Vec<u8>,

    #[serde_as(as = "Base64")]
    tx_summary_commit: Vec<u8>,

    // TODO: remove this when `getInputNoteIds` avaialabe for `TransactionRequest` in web-sdk
    input_note_ids: Vec<NoteIdPayload>,

    #[serde(skip_serializing_if = "Option::is_none")]
    signature_count: Option<NonZeroU32>,

    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[serde_with::serde_as]
#[derive(Debug, Builder, Serialize)]
pub struct NoteIdPayload {
    note_id: String,

    #[serde_as(as = "Base64")]
    note_id_file_bytes: Vec<u8>,
}

impl From<MultisigAccount> for MultisigAccountPayload {
    fn from(account: MultisigAccount) -> Self {
        Self::builder()
            .address(account.account_id().to_bech32(account.network_id().clone()))
            .kind(account.kind().to_string())
            .threshold(account.threshold())
            .created_at(account.aux().created_at())
            .updated_at(account.aux().updated_at())
            .build()
    }
}

impl From<MultisigApprover> for MultisigApproverPayload {
    fn from(approver: MultisigApprover) -> Self {
        let MultisigApproverDissolved {
            account_id,
            network_id,
            pub_key_commit,
            aux,
        } = approver.dissolve();

        Self::builder()
            .address(account_id.to_bech32(network_id))
            .pub_key_commit(Word::from(pub_key_commit).to_bytes())
            .created_at(aux.created_at())
            .updated_at(aux.updated_at())
            .build()
    }
}

impl From<MultisigTx> for MultisigTxPayload {
    fn from(tx: MultisigTx) -> Self {
        let MultisigTxDissolved {
            id,
            multisig_account_id,
            network_id,
            status,
            tx_request,
            tx_summary,
            tx_summary_commit,
            signature_count,
            aux,
        } = tx.dissolve();

        Self::builder()
            .id(id.into())
            .multisig_account_address(multisig_account_id.to_bech32(network_id))
            .status(status)
            .tx_request(tx_request.to_bytes())
            .tx_summary(tx_summary.to_bytes())
            .tx_summary_commit(tx_summary_commit.to_bytes())
            .input_note_ids(tx_request.get_input_note_ids().into_iter().map(From::from).collect())
            .maybe_signature_count(signature_count)
            .created_at(aux.created_at())
            .updated_at(aux.updated_at())
            .build()
    }
}

impl From<NoteId> for NoteIdPayload {
    fn from(note_id: NoteId) -> Self {
        Self::builder()
            .note_id(note_id.to_hex())
            .note_id_file_bytes(NoteFile::NoteId(note_id).to_bytes())
            .build()
    }
}
