use bon::Builder;
use diesel::prelude::Insertable;
use uuid::Uuid;

use crate::persistence::schema;

#[derive(Debug, Builder, Insertable)]
#[diesel(table_name = schema::contract_tx)]
pub struct NewContractTxRecord<'a> {
    contract_id: &'a str,
    status: &'a str,
    tx_bz: &'a [u8],
    tx_summary: &'a [u8],
    tx_summary_commitment: &'a [u8],
}

#[derive(Debug, Builder, Insertable)]
#[diesel(table_name = schema::tx_sig)]
pub struct NewTxSigRecord<'a> {
    tx_id: Uuid,
    approver_address: &'a str,
    sig: &'a [u8],
}

#[derive(Debug, Builder, Insertable)]
#[diesel(table_name = schema::multisig_contract)]
pub struct NewMultisigContractRecord<'a> {
    id: &'a str,
    threshold: i32,
    kind: &'a str,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = schema::approver)]
pub struct NewApproverRecord<'a> {
    pub address: &'a str,
    pub public_key: &'a [u8],
}
