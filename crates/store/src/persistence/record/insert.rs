use chrono::{DateTime, Utc};
use diesel::prelude::Insertable;

use crate::persistence::schema;

#[derive(Debug, Insertable)]
#[diesel(table_name = schema::contract_tx)]
pub struct NewContractTxRecord<'a> {
    pub id: &'a str,
    pub contract_id: &'a str,
    pub status: &'a str,
    pub effect: &'a str,
    pub created_at: Option<&'a DateTime<Utc>>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = schema::tx_sig)]
pub struct NewTxSigRecord<'a> {
    pub tx_id: &'a str,
    pub approver_address: &'a str,
    pub sig: &'a str,
    pub created_at: Option<&'a DateTime<Utc>>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = schema::multisig_contract)]
pub struct NewMultisigContractRecord<'a> {
    pub id: &'a str,
    pub threshold: i32,
    pub kind: &'a str,
    pub created_at: Option<&'a DateTime<Utc>>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = schema::approver)]
pub struct NewApproverRecord<'a> {
    pub address: &'a str,
    pub public_key: &'a str,
}
