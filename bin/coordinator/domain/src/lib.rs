#![allow(missing_docs)]
#![no_std]

extern crate alloc;

pub mod account;
pub mod tx;

#[cfg(feature = "serde")]
mod with_serde;

use bon::Builder;
use chrono::{DateTime, Utc};
use dissolve_derive::Dissolve;
use miden_client::account::AccountIdAddress;
use miden_objects::crypto::dsa::rpo_falcon512::{PublicKey, Signature};

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
pub struct MultisigApprover<AUX = Timestamps> {
    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_id_address"))]
    address: AccountIdAddress,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::pub_key_commit"))]
    pub_key_commit: PublicKey,

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
    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }
}
