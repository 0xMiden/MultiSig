use core::num::NonZeroU32;

use bon::Builder;
use dissolve_derive::Dissolve;
use miden_client::{
    Word,
    account::{AccountIdAddress, NetworkId},
    transaction::TransactionRequest,
};
use miden_objects::transaction::TransactionSummary;
use strum::{Display, EnumString, IntoStaticStr};
use uuid::Uuid;

#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

use crate::Timestamps;

#[cfg(feature = "serde")]
use crate::with_serde;

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MultisigTxId(Uuid);

#[derive(Debug, Clone, IntoStaticStr, EnumString, Display)]
#[strum(serialize_all = "snake_case")]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum MultisigTxStatus {
    Pending,
    Success,
    Failure,
}

#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MultisigTx<AUX = Timestamps> {
    id: MultisigTxId,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_id_address"))]
    address: AccountIdAddress,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::network_id"))]
    network_id: NetworkId,

    status: MultisigTxStatus,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::transaction_request"))]
    tx_request: TransactionRequest,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::transaction_summary"))]
    tx_summary: TransactionSummary,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::word"))]
    tx_summary_commit: Word,

    #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
    signature_count: Option<NonZeroU32>,

    aux: AUX,
}

impl From<Uuid> for MultisigTxId {
    fn from(uuid: Uuid) -> Self {
        Self(uuid)
    }
}

impl From<MultisigTxId> for Uuid {
    fn from(MultisigTxId(uuid): MultisigTxId) -> Self {
        uuid
    }
}

impl From<&MultisigTxId> for Uuid {
    fn from(MultisigTxId(uuid): &MultisigTxId) -> Self {
        *uuid
    }
}
