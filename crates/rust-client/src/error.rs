use alloc::borrow::Cow;

use miden_client::ClientError;

pub type Result<T, E = MultisigClientError> = core::result::Result<T, E>;

#[derive(Debug, thiserror::Error)]
pub enum MultisigClientError {
	#[error("client error: {0}")]
	Client(#[from] ClientError),

	#[error("multisig transaction proposal error: {0}")]
	MultisigTxProposalError(Cow<'static, str>),
}
