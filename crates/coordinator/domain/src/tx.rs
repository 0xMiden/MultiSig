//! Multisig transaction domain models and status tracking.

use core::{fmt, num::NonZeroU32};

use bon::Builder;
use dissolve_derive::Dissolve;
use miden_client::{
    Word,
    account::{AccountId, NetworkId},
    transaction::{TransactionRequest, TransactionSummary},
};
use strum::{Display, EnumString, IntoStaticStr};
use uuid::Uuid;

#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

use crate::Timestamps;

#[cfg(feature = "serde")]
use crate::with_serde;

/// A unique identifier for a multisig transaction.
///
/// This is a wrapper around a UUID that provides type safety and
/// seamless conversion to/from UUID values.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize), serde(transparent))]
pub struct MultisigTxId(Uuid);

/// The execution status of a multisig transaction.
///
/// A transaction progresses through these states as signatures are collected
/// and the transaction is executed.
#[derive(Debug, Clone, IntoStaticStr, EnumString, Display)]
#[strum(serialize_all = "snake_case")]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum MultisigTxStatus {
    /// The transaction is awaiting sufficient signatures to meet the threshold.
    Pending,
    /// The transaction has been successfully submitted on-chain.
    Success,
    /// The transaction execution failed.
    Failure,
}

/// A multisig transaction tracking signatures and execution state.
///
/// This represents a transaction that requires multiple signatures before
/// it can be executed. It tracks the transaction details, current status, and
/// the number of signatures collected.
///
/// # Type Parameters
///
/// * `AUX` - Auxiliary data type, defaults to [`Timestamps`] for tracking metadata.
#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize), serde_with::serde_as)]
pub struct MultisigTx<AUX = Timestamps> {
    /// The unique identifier for this transaction.
    id: MultisigTxId,

    /// The multisig account id to which this transaction applies.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_id"))]
    multisig_account_id: AccountId,

    /// The network this transaction is associated with.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::network_id"))]
    network_id: NetworkId,

    /// The current execution status of the transaction.
    #[cfg_attr(feature = "serde", serde_as(as = "DisplayFromStr"))]
    status: MultisigTxStatus,

    /// The transaction request.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::transaction_request"))]
    tx_request: TransactionRequest,

    /// The transaction summary produced after proposal.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::transaction_summary"))]
    tx_summary: TransactionSummary,

    /// A commitment to the transaction summary.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::word"))]
    tx_summary_commit: Word,

    /// The number of signatures currently collected (if any).
    #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
    signature_count: Option<NonZeroU32>,

    /// Auxiliary metadata associated with this transaction.
    aux: AUX,
}

/// Statistics for multisig transactions.
#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MultisigTxStats {
    /// The total number of transactions.
    total: u64,

    /// The number of transactions created since one month ago.
    last_month: u64,

    /// The total number of successfully executed transactions.
    total_success: u64,
}

impl From<Uuid> for MultisigTxId {
    /// Converts a UUID into a `MultisigTxId`.
    fn from(uuid: Uuid) -> Self {
        Self(uuid)
    }
}

impl From<MultisigTxId> for Uuid {
    /// Converts a `MultisigTxId` into its underlying UUID.
    fn from(MultisigTxId(uuid): MultisigTxId) -> Self {
        uuid
    }
}

impl From<&MultisigTxId> for Uuid {
    /// Converts a reference to `MultisigTxId` into a UUID.
    fn from(MultisigTxId(uuid): &MultisigTxId) -> Self {
        *uuid
    }
}

impl fmt::Display for MultisigTxId {
    /// Formats the `MultisigTxId` as its underlying UUID string representation.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}
