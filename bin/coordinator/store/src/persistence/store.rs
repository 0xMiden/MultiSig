mod error;

pub use self::error::StoreError;

use chrono::{DateTime, Utc};
use diesel::{
    AggregateExpressionMethods, BoolExpressionMethods, ExpressionMethods, JoinOnDsl,
    NullableExpressionMethods, QueryDsl, dsl,
    pg::upsert,
    result::OptionalExtension,
    sql_types::{Bytea, Nullable},
};
use diesel_async::RunQueryDsl;
use futures::TryStreamExt;
use oblux::U63;
use uuid::Uuid;

use crate::persistence::record::{TxStatus, select::ApproverRecord};

use super::{
    pool::DbConn,
    record::{
        insert::{NewApproverRecord, NewMultisigAccountRecord, NewSignatureRecord, NewTxRecord},
        select::{MultisigAccountRecord, TxRecord},
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

pub async fn fetch_txs_with_signature_count_by_multisig_account_address(
    conn: &mut DbConn,
    multisig_account_address: &str,
) -> Result<Vec<(TxRecord, U63)>> {
    schema::tx::table
        .left_join(schema::signature::table.on(schema::signature::tx_id.eq(schema::tx::id)))
        .filter(schema::tx::multisig_account_address.eq(multisig_account_address))
        .group_by(schema::tx::all_columns)
        .select((schema::tx::all_columns, dsl::count(schema::signature::tx_id.nullable())))
        .load_stream::<(_, i64)>(conn)
        .await?
        .map_ok(|(txr, c)| (txr, U63::from_signed(c).unwrap())) // unwrap is safe because count >= 0
        .try_collect()
        .await
        .map_err(From::from)
}

pub async fn fetch_txs_with_signature_count_by_multisig_account_address_and_status(
    conn: &mut DbConn,
    multisig_account_address: &str,
    tx_status: TxStatus,
) -> Result<Vec<(TxRecord, U63)>> {
    schema::tx::table
        .left_join(schema::signature::table.on(schema::signature::tx_id.eq(schema::tx::id)))
        .filter(schema::tx::multisig_account_address.eq(multisig_account_address))
        .filter(schema::tx::status.eq(tx_status))
        .group_by(schema::tx::all_columns)
        .select((schema::tx::all_columns, dsl::count(schema::signature::tx_id.nullable())))
        .load_stream::<(_, i64)>(conn)
        .await?
        .map_ok(|(txr, c)| (txr, U63::from_signed(c).unwrap())) // unwrap is safe because count >= 0
        .try_collect()
        .await
        .map_err(From::from)
}

pub async fn fetch_tx_with_signature_count_by_id(
    conn: &mut DbConn,
    id: Uuid,
) -> Result<Option<(TxRecord, U63)>> {
    schema::tx::table
        .left_join(schema::signature::table.on(schema::signature::tx_id.eq(schema::tx::id)))
        .filter(schema::tx::id.eq(id))
        .group_by(schema::tx::all_columns)
        .select((schema::tx::all_columns, dsl::count(schema::signature::tx_id.nullable())))
        .first::<(_, i64)>(conn)
        .await
        .map(|(txr, c)| (txr, U63::from_signed(c).unwrap())) // unwrap is safe because count >= 0
        .optional()
        .map_err(From::from)
}

pub async fn fetch_approver_by_approver_address(
    conn: &mut DbConn,
    approver_account_address: &str,
) -> Result<Option<ApproverRecord>> {
    schema::approver::table
        .select(schema::approver::all_columns)
        .filter(schema::approver::address.eq(approver_account_address))
        .first(conn)
        .await
        .optional()
        .map_err(From::from)
}

pub async fn fetch_all_signature_bytes_with_tx_by_tx_id_in_order_of_approvers(
    conn: &mut DbConn,
    tx_id: Uuid,
) -> Result<(Vec<Option<Vec<u8>>>, TxRecord)> {
    diesel::define_sql_function! {
        #[aggregate]
        fn array_agg(expr: Nullable<Bytea>) -> Array<Nullable<Bytea>>;
    }

    schema::tx::table
        .filter(schema::tx::id.eq(tx_id))
        .inner_join(
            schema::multisig_account_approver_mapping::table
                .on(schema::tx::multisig_account_address
                    .eq(schema::multisig_account_approver_mapping::multisig_account_address)),
        )
        .left_join(
            schema::signature::table.on(schema::signature::approver_address
                .eq(schema::multisig_account_approver_mapping::approver_address)
                .and(schema::signature::tx_id.eq(tx_id))),
        )
        .group_by((schema::tx::multisig_account_address, schema::tx::id))
        .select((
            array_agg(schema::signature::signature_bytes.nullable())
                .aggregate_order(schema::multisig_account_approver_mapping::approver_index.asc()),
            schema::tx::all_columns,
        ))
        .first(conn)
        .await
        .map_err(From::from)
}

pub async fn save_new_tx(conn: &mut DbConn, new_tx: NewTxRecord<'_>) -> Result<Uuid> {
    diesel::insert_into(schema::tx::table)
        .values(new_tx)
        .returning(schema::tx::id)
        .get_result(conn)
        .await
        .map_err(From::from)
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
    diesel::select(dsl::exists(
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

pub async fn save_new_multisig_account(
    conn: &mut DbConn,
    new_contract: NewMultisigAccountRecord<'_>,
) -> Result<DateTime<Utc>> {
    diesel::insert_into(schema::multisig_account::table)
        .values(new_contract)
        .returning(schema::multisig_account::created_at)
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

pub async fn save_new_multisig_account_approver_mapping(
    conn: &mut DbConn,
    multisig_account_address: &str,
    approver_address: &str,
    approver_index: u32,
) -> Result<()> {
    diesel::insert_into(schema::multisig_account_approver_mapping::table)
        .values((
            schema::multisig_account_approver_mapping::multisig_account_address
                .eq(multisig_account_address),
            schema::multisig_account_approver_mapping::approver_address.eq(approver_address),
            schema::multisig_account_approver_mapping::approver_index.eq(i64::from(approver_index)),
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
