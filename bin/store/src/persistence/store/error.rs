use std::borrow::Cow;

pub type Result<T, E = StoreError> = core::result::Result<T, E>;

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
	#[error("db error: {0}")]
	Db(#[from] diesel::result::Error),

	#[error("other error: {0}")]
	Other(Cow<'static, str>),
}

impl StoreError {
	pub fn other<E>(err: E) -> Self
	where
		Cow<'static, str>: From<E>,
	{
		Self::Other(From::from(err))
	}
}
