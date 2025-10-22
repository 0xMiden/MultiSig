pub mod request;
pub mod response;

use core::num::NonZeroU32;

use bon::Builder;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use miden_client::{Word, account::Address, utils::Serializable};
use miden_multisig_coordinator_domain::{
    MultisigApprover, MultisigApproverDissolved,
    account::MultisigAccount,
    tx::{MultisigTx, MultisigTxDissolved, MultisigTxStatus},
};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Builder, Serialize)]
pub struct MultisigAccountPayload {
    address: String,
    kind: String,
    threshold: NonZeroU32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Builder, Serialize)]
pub struct MultisigApproverPayload {
    address: String,
    pub_key_commit: Bytes,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Builder, Serialize)]
#[serde_with::serde_as]
pub struct MultisigTxPayload {
    id: Uuid,
    multisig_account_address: String,

    #[serde_as(as = "DisplayFromStr")]
    status: MultisigTxStatus,

    tx_request: Bytes,
    tx_summary: Bytes,
    tx_summary_commit: Bytes,

    #[serde(skip_serializing_if = "Option::is_none")]
    signature_count: Option<NonZeroU32>,

    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<MultisigAccount> for MultisigAccountPayload {
    fn from(account: MultisigAccount) -> Self {
        Self::builder()
            .address(Address::AccountId(account.address()).to_bech32(account.network_id()))
            .kind(account.kind().to_string())
            .threshold(account.threshold())
            .created_at(account.aux().created_at())
            .updated_at(account.aux().updated_at())
            .build()
    }
}

impl From<MultisigApprover> for MultisigApproverPayload {
    fn from(approver: MultisigApprover) -> Self {
        let MultisigApproverDissolved { address, network_id, pub_key_commit, aux } =
            approver.dissolve();

        Self::builder()
            .address(Address::AccountId(address).to_bech32(network_id))
            .pub_key_commit(Word::from(pub_key_commit).to_bytes().into())
            .created_at(aux.created_at())
            .updated_at(aux.updated_at())
            .build()
    }
}

impl From<MultisigTx> for MultisigTxPayload {
    fn from(tx: MultisigTx) -> Self {
        let MultisigTxDissolved {
            id,
            address,
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
            .multisig_account_address(Address::AccountId(address).to_bech32(network_id))
            .status(status)
            .tx_request(tx_request.to_bytes().into())
            .tx_summary(tx_summary.to_bytes().into())
            .tx_summary_commit(tx_summary_commit.to_bytes().into())
            .maybe_signature_count(signature_count)
            .created_at(aux.created_at())
            .updated_at(aux.updated_at())
            .build()
    }
}
