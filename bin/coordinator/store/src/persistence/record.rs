pub mod insert;
pub mod select;

use diesel_derive_enum::DbEnum;
use strum::{Display, EnumString};

#[derive(Debug, EnumString, Display, DbEnum)]
#[strum(serialize_all = "snake_case")]
#[ExistingTypePath = "crate::persistence::schema::sql_types::AccountKind"]
pub enum AccountKind {
    Private,
    Public,
}

#[derive(Debug, EnumString, Display, DbEnum)]
#[strum(serialize_all = "snake_case")]
#[ExistingTypePath = "crate::persistence::schema::sql_types::TxStatus"]
pub enum TxStatus {
    Pending,
    Success,
    Failure,
}
