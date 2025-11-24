//! Multisig account domain models and state management.

use core::num::NonZeroU32;

use alloc::vec::Vec;

use bon::Builder;
use dissolve_derive::Dissolve;
use miden_client::{
    account::{AccountId, AccountStorageMode, NetworkId},
    auth::PublicKeyCommitment,
};

#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

use crate::Timestamps;

#[cfg(feature = "serde")]
use crate::with_serde;

/// An approver authorized to sign multisig transactions.
///
/// Each approver is identified by their account id and has an associated
/// public key commitment used for signature verification.
///
/// # Type Parameters
///
/// * `AUX` - Auxiliary data type, defaults to [`Timestamps`] for tracking metadata.
#[derive(Debug, Clone, Builder, Dissolve)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MultisigApprover<AUX = Timestamps> {
    /// The account id of the approver.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_id"))]
    account_id: AccountId,

    /// The network this account belongs to.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::network_id"))]
    network_id: NetworkId,

    /// The public key commitment used for signature verification.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::pub_key_commit"))]
    pub_key_commit: PublicKeyCommitment,

    /// Auxiliary metadata associated with this approver.
    aux: AUX,
}

/// A multisig account with type-state pattern for tracking approvers and public key commitments.
///
/// This struct uses type parameters to enforce at compile-time that approvers and public key
/// commitments are properly set before the account can be used. The type parameters track
/// whether these fields have been populated.
///
/// # Type Parameters
///
/// * `APPR` - Approvers state: [`WithApprovers`] or [`WithoutApprovers`]
/// * `PKC` - Public key commits state: [`WithPubKeyCommits`] or [`WithoutPubKeyCommits`]
/// * `AUX` - Auxiliary data type, defaults to [`Timestamps`]
///
/// # Examples
///
/// ```ignore
/// // Create a new multisig account
/// let account = MultisigAccount::builder()
///     .account_id(account_id)
///     .network_id(network_id)
///     .kind(AccountStorageMode::Public)
///     .threshold(2)
///     .aux(())
///     .build();
///
/// // Add approvers (requires threshold to not exceed approver count)
/// let account = account.with_approvers(approvers)?;
///
/// // Add public key commitments
/// let account = account.with_pub_key_commits(pub_keys)?;
/// ```
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MultisigAccount<APPR = WithoutApprovers, PKC = WithoutPubKeyCommits, AUX = Timestamps> {
    /// The account's unique identifier.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_id"))]
    account_id: AccountId,

    /// The network this account belongs to.
    #[cfg_attr(feature = "serde", serde(with = "with_serde::network_id"))]
    network_id: NetworkId,

    /// The kind of account (public or private).
    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_storage_mode"))]
    kind: AccountStorageMode,

    /// The minimum number of signatures required to execute transactions.
    threshold: NonZeroU32,

    /// The list of approvers (type-state: present or absent).
    approvers: APPR,

    /// The public key commitments for approvers (type-state: present or absent).
    pub_key_commits: PKC,

    /// Auxiliary metadata associated with this account.
    aux: AUX,
}

/// Type-state marker indicating that approvers have been set.
///
/// This type wraps a vector of approver account ids and is used as a type parameter
/// in [`MultisigAccount`] to enforce compile-time checks.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct WithApprovers(
    #[cfg_attr(feature = "serde", serde(with = "with_serde::vec_account_id_address"))]
    Vec<AccountId>,
);

/// Type-state marker indicating that approvers have not been set.
///
/// Used as a type parameter in [`MultisigAccount`] to enforce compile-time checks.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct WithoutApprovers;

/// Type-state marker indicating that public key commitments have been set.
///
/// This type wraps a vector of public keys and is used as a type parameter
/// in [`MultisigAccount`] to enforce compile-time checks.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct WithPubKeyCommits(
    #[cfg_attr(feature = "serde", serde(with = "with_serde::vec_pub_key_commits"))]
    Vec<PublicKeyCommitment>,
);

/// Type-state marker indicating that public key commitments have not been set.
///
/// Used as a type parameter in [`MultisigAccount`] to enforce compile-time checks.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct WithoutPubKeyCommits;

#[bon::bon]
impl<AUX> MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX> {
    /// Creates a new multisig account without approvers or public key commitments.
    ///
    /// Use the builder pattern to construct a multisig account. After creation,
    /// use [`with_approvers`](Self::with_approvers) and [`with_pub_key_commits`](Self::with_pub_key_commits)
    /// to populate the account with approvers and their public key commiements.
    #[builder]
    pub fn new(
        account_id: AccountId,
        network_id: NetworkId,
        kind: AccountStorageMode,
        threshold: NonZeroU32,
        aux: AUX,
    ) -> Self {
        Self {
            account_id,
            network_id,
            kind,
            threshold,
            approvers: WithoutApprovers,
            pub_key_commits: WithoutPubKeyCommits,
            aux,
        }
    }
}

impl<APPR, PKC, AUX1> MultisigAccount<APPR, PKC, AUX1> {
    /// Replaces the auxiliary data with a new value, returning both the updated account
    /// and the old auxiliary data.
    ///
    /// This is useful for transforming metadata while preserving the account's core state.
    ///
    /// # Returns
    ///
    /// A tuple of (new account with `AUX2`, old `AUX1` value)
    pub fn with_aux<AUX2>(self, aux: AUX2) -> (MultisigAccount<APPR, PKC, AUX2>, AUX1) {
        let multisig_account = MultisigAccount {
            account_id: self.account_id,
            network_id: self.network_id,
            kind: self.kind,
            threshold: self.threshold,
            approvers: self.approvers,
            pub_key_commits: self.pub_key_commits,
            aux,
        };

        (multisig_account, self.aux)
    }
}

impl<AUX> MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX> {
    /// Adds approvers to the account.
    ///
    /// This transitions the account from [`WithoutApprovers`] to [`WithApprovers`] state when
    /// the threshold does not exceed the approver count.
    ///
    /// # Returns
    ///
    /// * `Some(account)` if the approver count meets or exceeds the threshold
    /// * `None` if there are fewer approvers than the threshold
    pub fn with_approvers(
        self,
        approver_account_ids: Vec<AccountId>,
    ) -> Option<MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX>> {
        // TODO: ascertain whether casting u32 to usize will always be safe
        (approver_account_ids.len() >= self.threshold.get() as usize).then(|| MultisigAccount {
            account_id: self.account_id,
            network_id: self.network_id,
            kind: self.kind,
            threshold: self.threshold,
            approvers: WithApprovers(approver_account_ids),
            pub_key_commits: WithoutPubKeyCommits,
            aux: self.aux,
        })
    }

    /// Adds public key commitments to the account.
    ///
    /// This transitions the account from [`WithoutPubKeyCommits`] to [`WithPubKeyCommits`] state when
    /// the threshold does not exceed the public key count.
    ///
    /// # Returns
    ///
    /// * `Some(account)` if the public key commitment count meets or exceeds the threshold
    /// * `None` if there are fewer public keys than the threshold
    pub fn with_pub_key_commits(
        self,
        pub_key_commits: Vec<PublicKeyCommitment>,
    ) -> Option<MultisigAccount<WithoutApprovers, WithPubKeyCommits, AUX>> {
        // TODO: ascertain whether casting u32 to usize will always be safe
        (pub_key_commits.len() >= self.threshold.get() as usize).then(|| MultisigAccount {
            account_id: self.account_id,
            network_id: self.network_id,
            kind: self.kind,
            threshold: self.threshold,
            approvers: WithoutApprovers,
            pub_key_commits: WithPubKeyCommits(pub_key_commits),
            aux: self.aux,
        })
    }
}

impl<AUX> MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX> {
    /// Adds public key commitments to an account that already has approvers when
    /// the number of public keys exactly matches the number of approvers.
    ///
    /// # Returns
    ///
    /// * `Some(account)` if the public key commitment count matches the approver count
    /// * `None` if the counts don't match
    pub fn with_pub_key_commits(
        self,
        pub_key_commits: Vec<PublicKeyCommitment>,
    ) -> Option<MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>> {
        (self.approvers.get().len() == pub_key_commits.len()).then(|| MultisigAccount {
            account_id: self.account_id,
            network_id: self.network_id,
            kind: self.kind,
            threshold: self.threshold,
            approvers: self.approvers,
            pub_key_commits: WithPubKeyCommits(pub_key_commits),
            aux: self.aux,
        })
    }
}

impl<AUX> MultisigAccount<WithoutApprovers, WithPubKeyCommits, AUX> {
    /// Adds approvers to an account that already has public key commitments when
    /// the number of approvers exactly matches the number of public keys.
    ///
    /// # Returns
    ///
    /// * `Some(account)` if the approver count matches the public key commitment count
    /// * `None` if the counts don't match
    pub fn with_approvers(
        self,
        approver_account_ids: Vec<AccountId>,
    ) -> Option<MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>> {
        (self.pub_key_commits.get().len() == approver_account_ids.len()).then(|| MultisigAccount {
            account_id: self.account_id,
            network_id: self.network_id,
            kind: self.kind,
            threshold: self.threshold,
            approvers: WithApprovers(approver_account_ids),
            pub_key_commits: self.pub_key_commits,
            aux: self.aux,
        })
    }
}

impl<APPR, PKC, AUX> MultisigAccount<APPR, PKC, AUX> {
    /// Returns the account id.
    pub fn account_id(&self) -> AccountId {
        self.account_id
    }

    /// Returns the network ID this account belongs to.
    pub fn network_id(&self) -> &NetworkId {
        &self.network_id
    }

    /// Returns the account kind.
    pub fn kind(&self) -> AccountStorageMode {
        self.kind
    }

    /// Returns the signature threshold required for transaction execution.
    pub fn threshold(&self) -> NonZeroU32 {
        self.threshold
    }

    /// Returns a reference to the auxiliary metadata.
    pub fn aux(&self) -> &AUX {
        &self.aux
    }
}

impl<PKC, AUX> MultisigAccount<WithApprovers, PKC, AUX> {
    /// Returns the list of approver account ids.
    pub fn approvers(&self) -> &[AccountId] {
        self.approvers.get()
    }
}

impl<APPR, AUX> MultisigAccount<APPR, WithPubKeyCommits, AUX> {
    /// Returns the list of public key commitments.
    pub fn pub_key_commits(&self) -> &[PublicKeyCommitment] {
        self.pub_key_commits.get()
    }
}

impl<AUX> MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX> {
    /// Dissolves the account, extracting the auxiliary data and returning a bare account.
    ///
    /// This replaces the auxiliary data with `()` and returns both the stripped account
    /// and the original auxiliary data.
    pub fn dissolve(self) -> (MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, ()>, AUX) {
        self.with_aux(())
    }
}

impl<AUX> MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX> {
    /// Dissolves the account, extracting the approvers and auxiliary data.
    ///
    /// Returns a tuple of:
    /// 1. A bare account (no approvers, no pub keys, `()` as auxiliary data)
    /// 2. The list of approver account ids
    /// 3. The original auxiliary data
    pub fn dissolve(
        self,
    ) -> (MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, ()>, Vec<AccountId>, AUX) {
        let multisig_account = MultisigAccount {
            account_id: self.account_id,
            network_id: self.network_id,
            kind: self.kind,
            threshold: self.threshold,
            approvers: WithoutApprovers,
            pub_key_commits: WithoutPubKeyCommits,
            aux: (),
        };

        (multisig_account, self.approvers.into_inner(), self.aux)
    }
}

impl<AUX> MultisigAccount<WithoutApprovers, WithPubKeyCommits, AUX> {
    /// Dissolves the account, extracting the public key commitments and auxiliary data.
    ///
    /// Returns a tuple of:
    /// 1. A bare account (no approvers, no pub keys, `()` as auxiliary data)
    /// 2. The list of public key commitments
    /// 3. The original auxiliary data
    pub fn dissolve(
        self,
    ) -> (
        MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, ()>,
        Vec<PublicKeyCommitment>,
        AUX,
    ) {
        let multisig_account = MultisigAccount {
            account_id: self.account_id,
            network_id: self.network_id,
            kind: self.kind,
            threshold: self.threshold,
            approvers: WithoutApprovers,
            pub_key_commits: WithoutPubKeyCommits,
            aux: (),
        };

        (multisig_account, self.pub_key_commits.into_inner(), self.aux)
    }
}

impl<AUX> MultisigAccount<WithApprovers, WithPubKeyCommits, AUX> {
    /// Dissolves a fully configured account, extracting all data.
    ///
    /// Returns a tuple of:
    /// 1. A bare account - (no approvers, no public key commitments, `()` as auxiliary data)
    /// 2. The list of approver account ids
    /// 3. The list of public key commitments
    /// 4. The original auxiliary data
    pub fn dissolve(
        self,
    ) -> (
        MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, ()>,
        Vec<AccountId>,
        Vec<PublicKeyCommitment>,
        AUX,
    ) {
        let multisig_account = MultisigAccount {
            account_id: self.account_id,
            network_id: self.network_id,
            kind: self.kind,
            threshold: self.threshold,
            approvers: WithoutApprovers,
            pub_key_commits: WithoutPubKeyCommits,
            aux: (),
        };

        (
            multisig_account,
            self.approvers.into_inner(),
            self.pub_key_commits.into_inner(),
            self.aux,
        )
    }
}

impl WithApprovers {
    fn get(&self) -> &[AccountId] {
        &self.0
    }

    fn into_inner(self) -> Vec<AccountId> {
        self.0
    }
}

impl WithPubKeyCommits {
    fn get(&self) -> &[PublicKeyCommitment] {
        &self.0
    }

    fn into_inner(self) -> Vec<PublicKeyCommitment> {
        self.0
    }
}

impl<AUX> From<MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>>
    for MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX>
{
    /// Converts a fully configured account to a bare account,
    /// discarding approvers and public key commitments.
    fn from(multisig_account: MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>) -> Self {
        let (multisig_account, _, _, aux) = multisig_account.dissolve();
        multisig_account.with_aux(aux).0
    }
}

impl<AUX> From<MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX>>
    for MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX>
{
    /// Converts an account with approvers to a bare account, discarding approvers.
    fn from(multisig_account: MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX>) -> Self {
        let (multisig_account, _, aux) = multisig_account.dissolve();
        multisig_account.with_aux(aux).0
    }
}

impl<AUX> From<MultisigAccount<WithoutApprovers, WithPubKeyCommits, AUX>>
    for MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX>
{
    /// Converts an account with public key commitments to a bare account,
    /// discarding public key commitments.
    fn from(multisig_account: MultisigAccount<WithoutApprovers, WithPubKeyCommits, AUX>) -> Self {
        let (multisig_account, _, aux) = multisig_account.dissolve();
        multisig_account.with_aux(aux).0
    }
}

impl<AUX> From<MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>>
    for MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX>
{
    /// Converts a fully configured account to one without public key commitments,
    /// keeping approvers.
    fn from(
        MultisigAccount {
            account_id,
            network_id,
            kind,
            threshold,
            approvers,
            aux,
            ..
        }: MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>,
    ) -> Self {
        Self {
            account_id,
            network_id,
            kind,
            threshold,
            approvers,
            pub_key_commits: WithoutPubKeyCommits,
            aux,
        }
    }
}

impl<AUX> From<MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>>
    for MultisigAccount<WithoutApprovers, WithPubKeyCommits, AUX>
{
    /// Converts a fully configured account to one without approvers, keeping public key commitments.
    fn from(
        MultisigAccount {
            account_id,
            network_id,
            kind,
            threshold,
            pub_key_commits,
            aux,
            ..
        }: MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>,
    ) -> Self {
        Self {
            account_id,
            network_id,
            kind,
            threshold,
            approvers: WithoutApprovers,
            pub_key_commits,
            aux,
        }
    }
}
