use miden_client::account::AccountIdAddress;

fn serialize_account_id_address(
    account_id_address: &AccountIdAddress,
) -> [u8; AccountIdAddress::SERIALIZED_SIZE] {
    (*account_id_address).into()
}

pub mod account_id_address {
    use miden_client::account::AccountIdAddress;
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S>(
        account_id_address: &AccountIdAddress,
        serializer: S,
    ) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&super::serialize_account_id_address(account_id_address))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<AccountIdAddress, D::Error>
    where
        D: Deserializer<'de>,
    {
        <[u8; AccountIdAddress::SERIALIZED_SIZE]>::deserialize(deserializer)
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

pub mod signature {
    use miden_client::utils::{Deserializable, Serializable};
    use miden_objects::crypto::dsa::rpo_falcon512::Signature;
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S>(signature: &Signature, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&signature.to_bytes())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Signature, D::Error>
    where
        D: Deserializer<'de>,
    {
        <&[u8]>::deserialize(deserializer)
            .map(Deserializable::read_from_bytes)?
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
    use miden_client::utils::{Deserializable, Serializable};
    use miden_objects::transaction::TransactionSummary;
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

    use miden_client::account::AccountIdAddress;
    use serde::{
        Deserializer, Serializer,
        de::{self, SeqAccess, Visitor},
        ser::SerializeSeq,
    };

    pub fn serialize<S>(
        account_id_addresses: &Vec<AccountIdAddress>,
        serializer: S,
    ) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut seq = serializer.serialize_seq(account_id_addresses.len().into())?;

        for account_id_address in account_id_addresses {
            seq.serialize_element(&super::serialize_account_id_address(account_id_address))?;
        }

        seq.end()
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<AccountIdAddress>, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct AccountIdAddressVecVisitor;

        impl<'de> Visitor<'de> for AccountIdAddressVecVisitor {
            type Value = Vec<AccountIdAddress>;

            fn expecting(&self, formatter: &mut Formatter) -> fmt::Result {
                formatter.write_str("a sequence of account ids")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let mut account_id_addresses = Vec::with_capacity(seq.size_hint().unwrap_or(0));

                while let Some(bz) =
                    seq.next_element::<[u8; AccountIdAddress::SERIALIZED_SIZE]>()?
                {
                    account_id_addresses.push(bz.try_into().map_err(de::Error::custom)?);
                }

                Ok(account_id_addresses)
            }
        }

        deserializer.deserialize_seq(AccountIdAddressVecVisitor)
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
