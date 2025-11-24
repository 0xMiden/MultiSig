use miden_client::account::AccountId;

fn serialize_account_id_address(account_id: &AccountId) -> [u8; AccountId::SERIALIZED_SIZE] {
    (*account_id).into()
}

pub mod account_id {
    use miden_client::account::AccountId;
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S>(account_id: &AccountId, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&super::serialize_account_id_address(account_id))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<AccountId, D::Error>
    where
        D: Deserializer<'de>,
    {
        <[u8; AccountId::SERIALIZED_SIZE]>::deserialize(deserializer)
            .map(TryFrom::try_from)?
            .map_err(D::Error::custom)
    }
}

pub mod account_storage_mode {
    use core::str::FromStr;

    use miden_client::account::AccountStorageMode;
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S>(
        account_storage_mode: &AccountStorageMode,
        serializer: S,
    ) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let kind = match account_storage_mode {
            AccountStorageMode::Public => "public",
            AccountStorageMode::Network => "network",
            AccountStorageMode::Private => "private",
        };

        serializer.serialize_str(kind)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<AccountStorageMode, D::Error>
    where
        D: Deserializer<'de>,
    {
        <&str>::deserialize(deserializer)
            .map(FromStr::from_str)?
            .map_err(D::Error::custom)
    }
}

pub mod network_id {
    use core::str::FromStr;

    use miden_client::account::NetworkId;
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S>(network_id: &NetworkId, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(network_id.as_str())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<NetworkId, D::Error>
    where
        D: Deserializer<'de>,
    {
        <&str>::deserialize(deserializer)
            .map(FromStr::from_str)?
            .map_err(D::Error::custom)
    }
}

pub mod pub_key_commit {
    use miden_client::{Word, auth::PublicKeyCommitment};
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S>(
        &pub_key_commit: &PublicKeyCommitment,
        serializer: S,
    ) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&Word::from(pub_key_commit).as_bytes())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<PublicKeyCommitment, D::Error>
    where
        D: Deserializer<'de>,
    {
        <[u8; Word::SERIALIZED_SIZE]>::deserialize(deserializer)
            .map(Word::try_from)?
            .map(From::from)
            .map_err(D::Error::custom)
    }
}

pub mod transaction_request {
    use miden_client::{
        transaction::TransactionRequest,
        utils::{Deserializable, Serializable},
    };
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S>(tx_req: &TransactionRequest, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&tx_req.to_bytes())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<TransactionRequest, D::Error>
    where
        D: Deserializer<'de>,
    {
        <&[u8]>::deserialize(deserializer)
            .map(Deserializable::read_from_bytes)?
            .map_err(D::Error::custom)
    }
}

pub mod transaction_summary {
    use miden_client::{
        transaction::TransactionSummary,
        utils::{Deserializable, Serializable},
    };
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S>(tx_summary: &TransactionSummary, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&tx_summary.to_bytes())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<TransactionSummary, D::Error>
    where
        D: Deserializer<'de>,
    {
        <&[u8]>::deserialize(deserializer)
            .map(Deserializable::read_from_bytes)?
            .map_err(D::Error::custom)
    }
}

pub mod vec_account_id_address {
    use alloc::{
        fmt::{self, Formatter},
        vec::Vec,
    };

    use miden_client::account::AccountId;
    use serde::{
        Deserializer, Serializer,
        de::{self, SeqAccess, Visitor},
        ser::SerializeSeq,
    };

    pub fn serialize<S>(account_id: &Vec<AccountId>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut seq = serializer.serialize_seq(account_id.len().into())?;

        for account_id_address in account_id {
            seq.serialize_element(&super::serialize_account_id_address(account_id_address))?;
        }

        seq.end()
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<AccountId>, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct AccountIdVecVisitor;

        impl<'de> Visitor<'de> for AccountIdVecVisitor {
            type Value = Vec<AccountId>;

            fn expecting(&self, formatter: &mut Formatter) -> fmt::Result {
                formatter.write_str("a sequence of account ids")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let mut account_id = Vec::with_capacity(seq.size_hint().unwrap_or(0));

                while let Some(bz) = seq.next_element::<[u8; AccountId::SERIALIZED_SIZE]>()? {
                    account_id.push(bz.try_into().map_err(de::Error::custom)?);
                }

                Ok(account_id)
            }
        }

        deserializer.deserialize_seq(AccountIdVecVisitor)
    }
}

pub mod vec_pub_key_commits {
    use alloc::{
        fmt::{self, Formatter},
        vec::Vec,
    };

    use miden_client::{Word, auth::PublicKeyCommitment};
    use serde::{
        Deserializer, Serializer,
        de::{self, SeqAccess, Visitor},
        ser::SerializeSeq,
    };

    pub fn serialize<S>(
        pub_key_commits: &Vec<PublicKeyCommitment>,
        serializer: S,
    ) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut seq = serializer.serialize_seq(pub_key_commits.len().into())?;

        for &pub_key_commit in pub_key_commits {
            seq.serialize_element(&Word::from(pub_key_commit).as_bytes())?;
        }

        seq.end()
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<PublicKeyCommitment>, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct PubKeyCommitVecVisitor;

        impl<'de> Visitor<'de> for PubKeyCommitVecVisitor {
            type Value = Vec<PublicKeyCommitment>;

            fn expecting(&self, formatter: &mut Formatter) -> fmt::Result {
                formatter.write_str("a sequence of public key commitments")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let mut pub_key_commits = Vec::with_capacity(seq.size_hint().unwrap_or(0));

                while let Some(bz) = seq.next_element::<[u8; Word::SERIALIZED_SIZE]>()? {
                    let pub_key_commit =
                        Word::try_from(bz).map(From::from).map_err(de::Error::custom)?;
                    pub_key_commits.push(pub_key_commit);
                }

                Ok(pub_key_commits)
            }
        }

        deserializer.deserialize_seq(PubKeyCommitVecVisitor)
    }
}

pub mod word {
    use miden_client::Word;
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S>(word: &Word, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&word.as_bytes())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Word, D::Error>
    where
        D: Deserializer<'de>,
    {
        <[u8; Word::SERIALIZED_SIZE]>::deserialize(deserializer)
            .map(TryFrom::try_from)?
            .map_err(D::Error::custom)
    }
}
