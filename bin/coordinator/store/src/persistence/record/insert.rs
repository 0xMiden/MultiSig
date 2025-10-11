use bon::Builder;
use diesel::prelude::Insertable;
use uuid::Uuid;

use crate::persistence::{
    record::{AccountKind, TxStatus},
    schema,
};

#[derive(Debug, Builder, Insertable)]
#[diesel(table_name = schema::multisig_account)]
pub struct NewMultisigAccountRecord<'a> {
    address: &'a str,
    threshold: i64,
    kind: AccountKind,
}

#[derive(Debug, Builder, Insertable)]
#[diesel(table_name = schema::approver)]
pub struct NewApproverRecord<'a> {
    address: &'a str,
    pub_key_commit: &'a [u8],
}

#[derive(Debug, Builder, Insertable)]
#[diesel(table_name = schema::tx)]
pub struct NewTxRecord<'a> {
    multisig_account_address: &'a str,
    status: TxStatus,
    tx_bytes: &'a [u8],
    tx_summary: &'a [u8],
    tx_summary_commit: &'a [u8],
}

#[derive(Debug, Builder, Insertable)]
#[diesel(table_name = schema::signature)]
pub struct NewSignatureRecord<'a> {
    tx_id: Uuid,
    approver_address: &'a str,
    signature_bytes: &'a [u8],
}
