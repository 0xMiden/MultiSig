use chrono::{DateTime, Utc};
use diesel::prelude::Queryable;

#[derive(Debug, Queryable)]
pub struct ContractApproverMappingRecord {
	pub contract_id: String,
	pub approver_address: String,
}

#[derive(Debug, Queryable)]
pub struct ContractTxRecord {
	pub tx_id: String,
	pub contract_id: String,
	pub status: String,
	pub tx_bz: String,
	pub effect: String,
	pub created_at: DateTime<Utc>,
}

#[derive(Debug, Queryable)]
pub struct TxSigRecord {
	pub tx_id: String,
	pub approver_address: String,
	pub sig: String,
	pub created_at: DateTime<Utc>,
}

#[derive(Debug, Queryable)]
pub struct MultisigContractRecord {
	pub contract_id: String,
	pub threshold: i32,
	pub kind: String,
	pub created_at: DateTime<Utc>,
}
