use miden_objects::{
    AddressError,
    account::NetworkId,
    address::{AccountIdAddress, Address},
};

/// Decodes the bech32 string then returns [`NetworkId`] and [`AccountIdAddress`] pair.
///
/// # Errors
///
/// When the bech32 string does not correspond to [`AccountIdAddress`].
pub fn extract_network_id_account_id_address_pair(
    bech32: &str,
) -> Result<(NetworkId, AccountIdAddress), AccountIdAddressError> {
    if let (network_id, Address::AccountId(address)) = Address::from_bech32(bech32)? {
        return Ok((network_id, address));
    }

    Err(AccountIdAddressError::InvalidAccountIdAddress)
}

/// Error that occurs while invoking [`extract_network_id_account_id_address_pair`].
#[derive(Debug, thiserror::Error)]
pub enum AccountIdAddressError {
    /// Address error
    #[error("address error: {0}")]
    Address(#[from] AddressError),

    /// When the bech32 string does not correspond to [`AccountIdAddress`]
    #[error("invalid account id address error")]
    InvalidAccountIdAddress,
}
