// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "account_kind"))]
    pub struct AccountKind;

    #[derive(diesel::query_builder::QueryId, diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "tx_status"))]
    pub struct TxStatus;
}

diesel::table! {
    approver (address) {
        address -> Text,
        pub_key_commit -> Bytea,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::AccountKind;

    multisig_account (address) {
        address -> Text,
        kind -> AccountKind,
        threshold -> Int8,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    multisig_account_approver_mapping (multisig_account_address, approver_address) {
        multisig_account_address -> Text,
        approver_address -> Text,
        approver_index -> Int8,
    }
}

diesel::table! {
    signature (tx_id, approver_address) {
        tx_id -> Uuid,
        approver_address -> Text,
        signature_bytes -> Bytea,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::TxStatus;

    tx (id) {
        id -> Uuid,
        multisig_account_address -> Text,
        status -> TxStatus,
        tx_bytes -> Bytea,
        tx_summary -> Bytea,
        tx_summary_commit -> Bytea,
        created_at -> Timestamptz,
    }
}

diesel::joinable!(multisig_account_approver_mapping -> approver (approver_address));
diesel::joinable!(multisig_account_approver_mapping -> multisig_account (multisig_account_address));
diesel::joinable!(signature -> approver (approver_address));
diesel::joinable!(signature -> tx (tx_id));
diesel::joinable!(tx -> multisig_account (multisig_account_address));

diesel::allow_tables_to_appear_in_same_query!(
    approver,
    multisig_account,
    multisig_account_approver_mapping,
    signature,
    tx,
);
