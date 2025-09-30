// @generated automatically by Diesel CLI.

diesel::table! {
    approver (address) {
        address -> Text,
        public_key -> Text,
    }
}

diesel::table! {
    contract_approver_mapping (contract_id, approver_address) {
        contract_id -> Text,
        approver_address -> Text,
    }
}

diesel::table! {
    contract_tx (id) {
        id -> Text,
        contract_id -> Text,
        status -> Text,
        tx_bz -> Text,
        effect -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    multisig_contract (id) {
        id -> Text,
        threshold -> Int4,
        kind -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    tx_sig (tx_id, approver_address) {
        tx_id -> Text,
        approver_address -> Text,
        sig -> Text,
        created_at -> Timestamptz,
    }
}

diesel::joinable!(contract_approver_mapping -> approver (approver_address));
diesel::joinable!(contract_approver_mapping -> multisig_contract (contract_id));
diesel::joinable!(contract_tx -> multisig_contract (contract_id));
diesel::joinable!(tx_sig -> approver (approver_address));
diesel::joinable!(tx_sig -> contract_tx (tx_id));

diesel::allow_tables_to_appear_in_same_query!(
    approver,
    contract_approver_mapping,
    contract_tx,
    multisig_contract,
    tx_sig,
);
