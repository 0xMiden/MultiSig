//! Domain types for the multisig coordinator.
//!
//! This crate provides the core domain models for managing multisig accounts and transactions
//! in the Miden multisig coordinator system. It includes type-safe builders and state tracking
//! for accounts and transactions.

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

/// Timestamp metadata for tracking entity creation and modification times.
///
/// This struct is commonly used as auxiliary data (`AUX`) in other domain types
/// to track when entities were created and last updated.
#[allow(missing_docs)]
#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct Timestamps {
    /// The timestamp when the entity was created.
    created_at: DateTime<Utc>,
    /// The timestamp when the entity was last updated.
    updated_at: DateTime<Utc>,
}

/// An approver authorized to sign multisig transactions.
///
/// Each approver is identified by their account address and has an associated
/// public key commitment used for signature verification.
///
/// # Type Parameters
///
/// * `AUX` - Auxiliary data type, defaults to [`Timestamps`] for tracking metadata.
#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MultisigApprover<AUX = Timestamps> {
    /// The account address of the approver.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_id_address"))]
    address: AccountIdAddress,

    /// The public key commitment used for signature verification.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::pub_key_commit"))]
    pub_key_commit: PublicKey,

    /// Auxiliary metadata associated with this approver.
    aux: AUX,
}

/// A signature from an approver for a multisig transaction.
///
/// Each signature is associated with a specific transaction and approver,
/// containing the cryptographic signature used to authorize the transaction.
///
/// # Type Parameters
///
/// * `AUX` - Auxiliary data type, defaults to [`Timestamps`] for tracking metadata.
#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MultisigSignature<AUX = Timestamps> {
    /// The ID of the transaction being signed.
    tx_id: MultisigTxId,

    /// The account address of the approver providing this signature.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_id_address"))]
    approver: AccountIdAddress,

    /// The cryptographic signature.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::signature"))]
    signature: Signature,

    /// Auxiliary metadata associated with this signature.
    aux: AUX,
}

impl Timestamps {
    /// Returns the creation timestamp.
    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    /// Returns the last update timestamp.
    pub fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }
}
