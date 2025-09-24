use std::borrow::Cow;

use miden_multisig_client::MultisigClientError;

pub type Result<T, E = MidenRuntimeError> = core::result::Result<T, E>;

#[derive(Debug, thiserror::Error)]
pub enum MidenRuntimeError {
	#[error("multisig client error: {0}")]
	MultisigClient(#[from] MultisigClientError),

	#[error("other error: {0}")]
	Other(Cow<'static, str>),
}
