use core::num::NonZeroU32;

use alloc::vec::Vec;

use miden_client::account::{AccountIdAddress, AccountStorageMode, NetworkId};
use miden_objects::crypto::dsa::rpo_falcon512::PublicKey;

#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

use crate::Timestamps;

#[cfg(feature = "serde")]
use crate::with_serde;

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MultisigAccount<APPR = WithoutApprovers, PKC = WithoutPubKeyCommits, AUX = Timestamps> {
    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_id_address"))]
    address: AccountIdAddress,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::network_id"))]
    network_id: NetworkId,

    #[cfg_attr(feature = "serde", serde(with = "with_serde::account_storage_mode"))]
    kind: AccountStorageMode,

    threshold: NonZeroU32,
    approvers: APPR,
    pub_key_commits: PKC,
    aux: AUX,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct WithApprovers(
    #[cfg_attr(feature = "serde", serde(with = "with_serde::vec_account_id_address"))]
    Vec<AccountIdAddress>,
);

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct WithoutApprovers;

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct WithPubKeyCommits(
    #[cfg_attr(feature = "serde", serde(with = "with_serde::vec_pub_key_commits"))] Vec<PublicKey>,
);

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct WithoutPubKeyCommits;

#[bon::bon]
impl<AUX> MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX> {
    #[builder]
    pub fn new(
        address: AccountIdAddress,
        network_id: NetworkId,
        kind: AccountStorageMode,
        threshold: NonZeroU32,
        aux: AUX,
    ) -> Self {
        Self {
            address,
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
    pub fn with_aux<AUX2>(self, aux: AUX2) -> (MultisigAccount<APPR, PKC, AUX2>, AUX1) {
        let multisig_account = MultisigAccount {
            address: self.address,
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
    pub fn with_approvers(
        self,
        approver_addresses: Vec<AccountIdAddress>,
    ) -> Option<MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX>> {
        // TODO: ascertain whether casting u32 to usize will always be safe
        (approver_addresses.len() >= self.threshold.get() as usize).then(|| MultisigAccount {
            address: self.address,
            network_id: self.network_id,
            kind: self.kind,
            threshold: self.threshold,
            approvers: WithApprovers(approver_addresses),
            pub_key_commits: WithoutPubKeyCommits,
            aux: self.aux,
        })
    }

    pub fn with_pub_key_commits(
        self,
        pub_key_commits: Vec<PublicKey>,
    ) -> Option<MultisigAccount<WithoutApprovers, WithPubKeyCommits, AUX>> {
        // TODO: ascertain whether casting u32 to usize will always be safe
        (pub_key_commits.len() >= self.threshold.get() as usize).then(|| MultisigAccount {
            address: self.address,
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
    pub fn with_pub_key_commits(
        self,
        pub_key_commits: Vec<PublicKey>,
    ) -> Option<MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>> {
        (self.approvers.get().len() == pub_key_commits.len()).then(|| MultisigAccount {
            address: self.address,
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
    pub fn with_approvers(
        self,
        approver_addresses: Vec<AccountIdAddress>,
    ) -> Option<MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>> {
        (self.pub_key_commits.get().len() == approver_addresses.len()).then(|| MultisigAccount {
            address: self.address,
            network_id: self.network_id,
            kind: self.kind,
            threshold: self.threshold,
            approvers: WithApprovers(approver_addresses),
            pub_key_commits: self.pub_key_commits,
            aux: self.aux,
        })
    }
}

impl<APPR, PKC, AUX> MultisigAccount<APPR, PKC, AUX> {
    pub fn address(&self) -> AccountIdAddress {
        self.address
    }

    pub fn network_id(&self) -> NetworkId {
        self.network_id
    }

    pub fn kind(&self) -> AccountStorageMode {
        self.kind
    }

    pub fn threshold(&self) -> NonZeroU32 {
        self.threshold
    }

    pub fn aux(&self) -> &AUX {
        &self.aux
    }
}

impl<PKC, AUX> MultisigAccount<WithApprovers, PKC, AUX> {
    pub fn approvers(&self) -> &[AccountIdAddress] {
        self.approvers.get()
    }
}

impl<APPR, AUX> MultisigAccount<APPR, WithPubKeyCommits, AUX> {
    pub fn pub_key_commits(&self) -> &[PublicKey] {
        self.pub_key_commits.get()
    }
}

impl<AUX> MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX> {
    pub fn dissolve(self) -> (MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, ()>, AUX) {
        self.with_aux(())
    }
}

impl<AUX> MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX> {
    pub fn dissolve(
        self,
    ) -> (
        MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, ()>,
        Vec<AccountIdAddress>,
        AUX,
    ) {
        let multisig_account = MultisigAccount {
            address: self.address,
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
    pub fn dissolve(
        self,
    ) -> (MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, ()>, Vec<PublicKey>, AUX) {
        let multisig_account = MultisigAccount {
            address: self.address,
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
    pub fn dissolve(
        self,
    ) -> (
        MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, ()>,
        Vec<AccountIdAddress>,
        Vec<PublicKey>,
        AUX,
    ) {
        let multisig_account = MultisigAccount {
            address: self.address,
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
    fn get(&self) -> &[AccountIdAddress] {
        &self.0
    }

    fn into_inner(self) -> Vec<AccountIdAddress> {
        self.0
    }
}

impl WithPubKeyCommits {
    fn get(&self) -> &[PublicKey] {
        &self.0
    }

    fn into_inner(self) -> Vec<PublicKey> {
        self.0
    }
}

impl<AUX> From<MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>>
    for MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX>
{
    fn from(multisig_account: MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>) -> Self {
        let (multisig_account, _, _, aux) = multisig_account.dissolve();
        multisig_account.with_aux(aux).0
    }
}

impl<AUX> From<MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX>>
    for MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX>
{
    fn from(multisig_account: MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX>) -> Self {
        let (multisig_account, _, aux) = multisig_account.dissolve();
        multisig_account.with_aux(aux).0
    }
}

impl<AUX> From<MultisigAccount<WithoutApprovers, WithPubKeyCommits, AUX>>
    for MultisigAccount<WithoutApprovers, WithoutPubKeyCommits, AUX>
{
    fn from(multisig_account: MultisigAccount<WithoutApprovers, WithPubKeyCommits, AUX>) -> Self {
        let (multisig_account, _, aux) = multisig_account.dissolve();
        multisig_account.with_aux(aux).0
    }
}

impl<AUX> From<MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>>
    for MultisigAccount<WithApprovers, WithoutPubKeyCommits, AUX>
{
    fn from(
        MultisigAccount {
            address,
            network_id,
            kind,
            threshold,
            approvers,
            aux,
            ..
        }: MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>,
    ) -> Self {
        Self {
            address,
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
    fn from(
        MultisigAccount {
            address,
            network_id,
            kind,
            threshold,
            pub_key_commits,
            aux,
            ..
        }: MultisigAccount<WithApprovers, WithPubKeyCommits, AUX>,
    ) -> Self {
        Self {
            address,
            network_id,
            kind,
            threshold,
            approvers: WithoutApprovers,
            pub_key_commits,
            aux,
        }
    }
}
