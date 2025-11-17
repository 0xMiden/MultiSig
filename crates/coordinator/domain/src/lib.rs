//! Domain types for the multisig coordinator.
//!
//! This crate provides the core domain models for managing multisig accounts and transactions
//! in the multisig coordinator system. It includes type-safe builders and state tracking
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

#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

/// Timestamp metadata for tracking entity creation and modification times.
///
/// This struct is commonly used as auxiliary data (`AUX`) in other domain types
/// to track when entities were created and last updated.
#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct Timestamps {
    /// The timestamp when the entity was created.
    created_at: DateTime<Utc>,
    /// The timestamp when the entity was last updated.
    updated_at: DateTime<Utc>,
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
