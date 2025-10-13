#![allow(missing_docs)]
#![no_std]

extern crate alloc;

pub mod tx;

#[cfg(feature = "serde")]
mod with_serde;

use core::num::NonZeroU32;

use alloc::vec::Vec;

use bon::Builder;
use chrono::{DateTime, Utc};
use dissolve_derive::Dissolve;
use miden_client::account::{AccountIdAddress, AccountStorageMode, NetworkId};

use miden_objects::crypto::dsa::rpo_falcon512::Signature;
#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

use self::tx::MultisigTxId;

#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct Timestamps {
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MultisigAccount<AUX = Timestamps> {
    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_id_address"))]
    address: AccountIdAddress,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::network_id"))]
    network_id: NetworkId,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_storage_mode"))]
    kind: AccountStorageMode,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::vec_account_id_address"))]
    approvers: Vec<AccountIdAddress>,

    threshold: NonZeroU32,

    aux: AUX,
}

#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MultisigSignature<AUX = Timestamps> {
    tx_id: MultisigTxId,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_id_address"))]
    approver: AccountIdAddress,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::signature"))]
    signature: Signature,

    aux: AUX,
}

impl Timestamps {
    pub fn created_at(&self) -> &DateTime<Utc> {
        &self.created_at
    }

    pub fn updated_at(&self) -> &DateTime<Utc> {
        &self.updated_at
    }
}
