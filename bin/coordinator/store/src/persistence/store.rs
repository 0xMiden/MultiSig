mod error;

use crate::persistence::record::TxStatus;

pub use self::error::StoreError;

use diesel::{
    ExpressionMethods, JoinOnDsl, NullableExpressionMethods, QueryDsl, pg::upsert,
    result::OptionalExtension,
};
use diesel_async::RunQueryDsl;
use uuid::Uuid;

use super::{
    pool::DbConn,
    record::{
        insert::{NewApproverRecord, NewMultisigAccountRecord, NewSignatureRecord, NewTxRecord},
        select::{MultisigAccountRecord, SignatureRecord, TxRecord},
    },
    schema,
};

use self::error::Result;

pub async fn fetch_mutisig_account_by_address(
    conn: &mut DbConn,
    address: &str,
) -> Result<Option<MultisigAccountRecord>> {
    schema::multisig_account::table
        .filter(schema::multisig_account::address.eq(address))
        .first(conn)
        .await
        .optional()
        .map_err(From::from)
}

pub async fn fetch_approvers_by_multisig_account_address(
    conn: &mut DbConn,
    multisig_account_address: &str,
) -> Result<Vec<String>> {
    schema::multisig_account_approver_mapping::table
        .select(schema::multisig_account_approver_mapping::approver_address)
        .filter(
            schema::multisig_account_approver_mapping::multisig_account_address
                .eq(multisig_account_address),
        )
        .load(conn)
        .await
        .map_err(From::from)
}

pub async fn fetch_tx_by_id(conn: &mut DbConn, id: Uuid) -> Result<Option<TxRecord>> {
    schema::tx::table
        .select(schema::tx::all_columns)
        .filter(schema::tx::id.eq(id))
        .first(conn)
        .await
        .optional()
        .map_err(From::from)
}

pub async fn fetch_signatures_by_tx_id(
    conn: &mut DbConn,
    tx_id: Uuid,
) -> Result<Vec<SignatureRecord>> {
    schema::signature::table
        .select(schema::signature::all_columns)
        .filter(schema::signature::tx_id.eq(tx_id))
        .load(conn)
        .await
        .map_err(From::from)
}

pub async fn fetch_txs_with_signature_count_by_multisig_account_address(
    conn: &mut DbConn,
    multisig_account_address: &str,
) -> Result<Vec<(TxRecord, i64)>> {
    schema::tx::table
        .left_join(schema::signature::table.on(schema::signature::tx_id.eq(schema::tx::id)))
        .filter(schema::tx::multisig_account_address.eq(multisig_account_address))
        .group_by((
            schema::tx::id,
            schema::tx::multisig_account_address,
            schema::tx::status,
            schema::tx::tx_bytes,
            schema::tx::tx_summary,
            schema::tx::tx_summary_commit,
            schema::tx::created_at,
        ))
        .select((
            (
                schema::tx::id,
                schema::tx::multisig_account_address,
                schema::tx::status,
                schema::tx::tx_bytes,
                schema::tx::tx_summary,
                schema::tx::tx_summary_commit,
                schema::tx::created_at,
            ),
            diesel::dsl::count(schema::signature::tx_id.nullable()),
        ))
        .load(conn)
        .await
        .map_err(From::from)
}

pub async fn fetch_txs_with_signature_count_by_multisig_account_address_and_status(
    conn: &mut DbConn,
    multisig_account_address: &str,
    tx_status: TxStatus,
) -> Result<Vec<(TxRecord, i64)>> {
    schema::tx::table
        .left_join(schema::signature::table.on(schema::signature::tx_id.eq(schema::tx::id)))
        .filter(schema::tx::multisig_account_address.eq(multisig_account_address))
        .filter(schema::tx::status.eq(tx_status))
        .group_by((
            schema::tx::id,
            schema::tx::multisig_account_address,
            schema::tx::status,
            schema::tx::tx_bytes,
            schema::tx::tx_summary,
            schema::tx::tx_summary_commit,
            schema::tx::created_at,
        ))
        .select((
            (
                schema::tx::id,
                schema::tx::multisig_account_address,
                schema::tx::status,
                schema::tx::tx_bytes,
                schema::tx::tx_summary,
                schema::tx::tx_summary_commit,
                schema::tx::created_at,
            ),
            diesel::dsl::count(schema::signature::tx_id.nullable()),
        ))
        .order(schema::tx::created_at.desc())
        .load(conn)
        .await
        .map_err(From::from)
}

pub async fn save_new_tx(conn: &mut DbConn, new_tx: NewTxRecord<'_>) -> Result<()> {
    diesel::insert_into(schema::tx::table).values(new_tx).execute(conn).await?;

    Ok(())
}

pub async fn update_status_by_tx_id(
    conn: &mut DbConn,
    tx_id: Uuid,
    new_status: TxStatus,
) -> Result<bool> {
    let affected = diesel::update(schema::tx::dsl::tx.filter(schema::tx::id.eq(tx_id)))
        .set(schema::tx::status.eq(new_status))
        .execute(conn)
        .await?;

    assert!(affected <= 1, "duplicate tx id must not exist");

    Ok(affected == 1)
}

pub async fn validate_approver_address_by_tx_id(
    conn: &mut DbConn,
    tx_id: Uuid,
    approver_address: &str,
) -> Result<bool> {
    diesel::select(diesel::dsl::exists(
        schema::multisig_account_approver_mapping::table
            .inner_join(
                schema::tx::table.on(schema::tx::multisig_account_address
                    .eq(schema::multisig_account_approver_mapping::multisig_account_address)),
            )
            .filter(schema::tx::id.eq(tx_id))
            .filter(
                schema::multisig_account_approver_mapping::approver_address.eq(approver_address),
            ),
    ))
    .get_result(conn)
    .await
    .map_err(From::from)
}

pub async fn save_new_signature(
    conn: &mut DbConn,
    new_signature: NewSignatureRecord<'_>,
) -> Result<()> {
    diesel::insert_into(schema::signature::table)
        .values(new_signature)
        .execute(conn)
        .await?;

    Ok(())
}

pub async fn save_new_multisig_contract(
    conn: &mut DbConn,
    new_contract: NewMultisigAccountRecord<'_>,
) -> Result<()> {
    diesel::insert_into(schema::multisig_account::table)
        .values(new_contract)
        .execute(conn)
        .await?;

    Ok(())
}

pub async fn save_new_multisig_account_approver_mapping(
    conn: &mut DbConn,
    multisig_account_address: &str,
    approver_address: &str,
) -> Result<()> {
    diesel::insert_into(schema::multisig_account_approver_mapping::table)
        .values((
            schema::multisig_account_approver_mapping::multisig_account_address
                .eq(multisig_account_address),
            schema::multisig_account_approver_mapping::approver_address.eq(approver_address),
        ))
        .execute(conn)
        .await?;

    Ok(())
}

pub async fn upsert_approver(conn: &mut DbConn, new_approver: NewApproverRecord<'_>) -> Result<()> {
    diesel::insert_into(schema::approver::table)
        .values(new_approver)
        .on_conflict(schema::approver::address)
        .do_update()
        .set(
            schema::approver::pub_key_commit.eq(upsert::excluded(schema::approver::pub_key_commit)),
        )
        .execute(conn)
        .await?;

    Ok(())
}
