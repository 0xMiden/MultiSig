mod error;

use diesel::{
    ExpressionMethods, JoinOnDsl, NullableExpressionMethods, QueryDsl, pg::upsert,
    result::OptionalExtension,
};
use diesel_async::RunQueryDsl;

pub use self::error::StoreError;

use super::{
    pool::DbConn,
    record::{
        insert::{
            NewApproverRecord, NewContractTxRecord, NewMultisigContractRecord, NewTxSigRecord,
        },
        select::{ContractTxRecord, MultisigContractRecord, TxSigRecord},
    },
    schema,
};

use self::error::Result;

pub async fn fetch_mutisig_contract_by_contract_id(
    conn: &mut DbConn,
    contract_id: &str,
) -> Result<Option<MultisigContractRecord>> {
    schema::multisig_contract::table
        .filter(schema::multisig_contract::id.eq(contract_id))
        .first(conn)
        .await
        .optional()
        .map_err(From::from)
}

pub async fn fetch_contract_approvers_by_contract_id(
    conn: &mut DbConn,
    contract_id: &str,
) -> Result<Vec<String>> {
    schema::contract_approver_mapping::table
        .select(schema::contract_approver_mapping::approver_address)
        .filter(schema::contract_approver_mapping::contract_id.eq(contract_id))
        .load(conn)
        .await
        .map_err(From::from)
}

pub async fn fetch_tx_by_tx_id(conn: &mut DbConn, tx_id: &str) -> Result<Option<ContractTxRecord>> {
    schema::contract_tx::table
        .select(schema::contract_tx::all_columns)
        .filter(schema::contract_tx::id.eq(tx_id))
        .first(conn)
        .await
        .optional()
        .map_err(From::from)
}

pub async fn fetch_txs_by_contract_id(
    conn: &mut DbConn,
    contract_id: &str,
) -> Result<Vec<ContractTxRecord>> {
    schema::contract_tx::table
        .select(schema::contract_tx::all_columns)
        .filter(schema::contract_tx::contract_id.eq(contract_id))
        .order(schema::contract_tx::created_at.desc())
        .load(conn)
        .await
        .map_err(From::from)
}

pub async fn fetch_txs_by_contract_id_and_tx_status(
    conn: &mut DbConn,
    contract_id: &str,
    tx_status: &str,
) -> Result<Vec<ContractTxRecord>> {
    schema::contract_tx::table
        .select(schema::contract_tx::all_columns)
        .filter(schema::contract_tx::contract_id.eq(contract_id))
        .filter(schema::contract_tx::status.eq(tx_status))
        .order(schema::contract_tx::created_at.desc())
        .load(conn)
        .await
        .map_err(From::from)
}

pub async fn save_new_contract_tx(
    conn: &mut DbConn,
    new_tx: NewContractTxRecord<'_>,
) -> Result<()> {
    diesel::insert_into(schema::contract_tx::table)
        .values(new_tx)
        .execute(conn)
        .await?;

    Ok(())
}

pub async fn update_status_by_contract_tx_status(
    conn: &mut DbConn,
    tx_id: &str,
    new_status: &str,
) -> Result<bool> {
    let affected = diesel::update(
        schema::contract_tx::dsl::contract_tx.filter(schema::contract_tx::id.eq(tx_id)),
    )
    .set(schema::contract_tx::status.eq(new_status))
    .execute(conn)
    .await?;

    if affected > 1 {
        return Err(StoreError::other("duplicate tx id"));
    }

    Ok(affected == 1)
}

pub async fn fetch_tx_sigs_count_by_tx_id(conn: &mut DbConn, tx_id: &str) -> Result<u64> {
    schema::tx_sig::table
        .filter(schema::tx_sig::tx_id.eq(tx_id))
        .count()
        .get_result::<i64>(conn)
        .await
        .map(TryFrom::try_from)?
        .map_err(|_| "count must be positive")
        .map_err(StoreError::other)
}

pub async fn validate_approver_address_by_tx_id(
    conn: &mut DbConn,
    tx_id: &str,
    approver_address: &str,
) -> Result<bool> {
    diesel::select(diesel::dsl::exists(
        schema::contract_approver_mapping::table
            .inner_join(schema::contract_tx::table.on(
                schema::contract_tx::contract_id.eq(schema::contract_approver_mapping::contract_id),
            ))
            .filter(schema::contract_tx::id.eq(tx_id))
            .filter(schema::contract_approver_mapping::approver_address.eq(approver_address)),
    ))
    .get_result(conn)
    .await
    .map_err(From::from)
}

pub async fn save_new_tx_sig(conn: &mut DbConn, new_tx_sig: NewTxSigRecord<'_>) -> Result<()> {
    diesel::insert_into(schema::tx_sig::table)
        .values(new_tx_sig)
        .execute(conn)
        .await?;

    Ok(())
}

pub async fn fetch_tx_sigs_by_tx_id(conn: &mut DbConn, tx_id: &str) -> Result<Vec<TxSigRecord>> {
    schema::tx_sig::table
        .select(schema::tx_sig::all_columns)
        .filter(schema::tx_sig::tx_id.eq(tx_id))
        .load(conn)
        .await
        .map_err(From::from)
}

pub async fn save_new_multisig_contract(
    conn: &mut DbConn,
    new_contract: NewMultisigContractRecord<'_>,
) -> Result<()> {
    diesel::insert_into(schema::multisig_contract::table)
        .values(new_contract)
        .execute(conn)
        .await?;

    Ok(())
}

pub async fn save_new_contract_approver_mapping(
    conn: &mut DbConn,
    contract_id: &str,
    approver_address: &str,
) -> Result<()> {
    diesel::insert_into(schema::contract_approver_mapping::table)
        .values((
            schema::contract_approver_mapping::contract_id.eq(contract_id),
            schema::contract_approver_mapping::approver_address.eq(approver_address),
        ))
        .execute(conn)
        .await?;

    Ok(())
}

pub async fn fetch_txs_with_sigs_count_by_contract_id(
    conn: &mut DbConn,
    contract_id: &str,
) -> Result<Vec<(ContractTxRecord, i64)>> {
    schema::contract_tx::table
        .left_join(schema::tx_sig::table.on(schema::tx_sig::tx_id.eq(schema::contract_tx::id)))
        .filter(schema::contract_tx::contract_id.eq(contract_id))
        .group_by((
            schema::contract_tx::id,
            schema::contract_tx::contract_id,
            schema::contract_tx::status,
            schema::contract_tx::tx_bz,
            schema::contract_tx::effect,
            schema::contract_tx::created_at,
        ))
        .select((
            (
                schema::contract_tx::id,
                schema::contract_tx::contract_id,
                schema::contract_tx::status,
                schema::contract_tx::tx_bz,
                schema::contract_tx::effect,
                schema::contract_tx::created_at,
            ),
            diesel::dsl::count(schema::tx_sig::tx_id.nullable()),
        ))
        .load(conn)
        .await
        .map_err(From::from)
}

pub async fn fetch_txs_with_sigs_count_by_contract_id_and_tx_status(
    conn: &mut DbConn,
    contract_id: &str,
    tx_status: &str,
) -> Result<Vec<(ContractTxRecord, i64)>> {
    schema::contract_tx::table
        .left_join(schema::tx_sig::table.on(schema::tx_sig::tx_id.eq(schema::contract_tx::id)))
        .filter(schema::contract_tx::contract_id.eq(contract_id))
        .filter(schema::contract_tx::status.eq(tx_status))
        .group_by((
            schema::contract_tx::id,
            schema::contract_tx::contract_id,
            schema::contract_tx::status,
            schema::contract_tx::tx_bz,
            schema::contract_tx::effect,
            schema::contract_tx::created_at,
        ))
        .select((
            (
                schema::contract_tx::id,
                schema::contract_tx::contract_id,
                schema::contract_tx::status,
                schema::contract_tx::tx_bz,
                schema::contract_tx::effect,
                schema::contract_tx::created_at,
            ),
            diesel::dsl::count(schema::tx_sig::tx_id.nullable()),
        ))
        .order(schema::contract_tx::created_at.desc())
        .load(conn)
        .await
        .map_err(From::from)
}

pub async fn upsert_approver(conn: &mut DbConn, new_approver: NewApproverRecord<'_>) -> Result<()> {
    diesel::insert_into(schema::approver::table)
        .values(new_approver)
        .on_conflict(schema::approver::address)
        .do_update()
        .set(schema::approver::public_key.eq(upsert::excluded(schema::approver::public_key)))
        .execute(conn)
        .await?;

    Ok(())
}
