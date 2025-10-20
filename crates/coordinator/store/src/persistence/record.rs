pub mod insert;
pub mod select;

use core::str::FromStr;

use std::io::Write;

use diesel::{
    backend::Backend,
    deserialize::{self, FromSql, FromSqlRow},
    expression::AsExpression,
    pg::Pg,
    serialize::{self, IsNull, Output, ToSql},
};
use miden_client::account::AccountStorageMode;
use miden_multisig_coordinator_domain::tx::MultisigTxStatus;

use crate::persistence::schema::sql_types::{
    AccountKind as AccountKindSql, TxStatus as TxStatusSql,
};

#[derive(Debug, AsExpression, FromSqlRow)]
#[diesel(sql_type = AccountKindSql)]
pub struct AccountKind(AccountStorageMode);

#[derive(Debug, AsExpression, FromSqlRow)]
#[diesel(sql_type = TxStatusSql)]
pub struct TxStatus(MultisigTxStatus);

impl AccountKind {
    const PUBLIC: &[u8] = b"public";

    const PRIVATE: &[u8] = b"private";

    pub fn into_inner(self) -> AccountStorageMode {
        self.0
    }
}

impl TxStatus {
    pub fn into_inner(self) -> MultisigTxStatus {
        self.0
    }
}

impl From<AccountStorageMode> for AccountKind {
    fn from(mode: AccountStorageMode) -> Self {
        Self(mode)
    }
}

impl From<MultisigTxStatus> for TxStatus {
    fn from(status: MultisigTxStatus) -> Self {
        Self(status)
    }
}

impl ToSql<AccountKindSql, Pg> for AccountKind {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match self.0 {
            AccountStorageMode::Public | AccountStorageMode::Network => {
                out.write_all(Self::PUBLIC)?
            },
            AccountStorageMode::Private => out.write_all(Self::PRIVATE)?,
        }

        Ok(IsNull::No)
    }
}

impl FromSql<AccountKindSql, Pg> for AccountKind {
    fn from_sql(bz: <Pg as Backend>::RawValue<'_>) -> deserialize::Result<Self> {
        match bz.as_bytes() {
            Self::PUBLIC => Ok(Self(AccountStorageMode::Public)),
            Self::PRIVATE => Ok(Self(AccountStorageMode::Private)),
            _ => Err("unrecognized enum variant for account kind".into()),
        }
    }
}

impl ToSql<TxStatusSql, Pg> for TxStatus {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        out.write_all(<&str>::from(&self.0).as_bytes())?;

        Ok(IsNull::No)
    }
}

impl FromSql<TxStatusSql, Pg> for TxStatus {
    fn from_sql(bz: <Pg as Backend>::RawValue<'_>) -> deserialize::Result<Self> {
        str::from_utf8(bz.as_bytes())
            .map(FromStr::from_str)?
            .map(Self)
            .map_err(From::from)
    }
}
