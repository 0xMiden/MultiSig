// @generated automatically by Diesel CLI.

diesel::table! {
    approver (address) {
        address -> Text,
        public_key -> Text,
    }
}

diesel::table! {
    contract_approvers (contract_id, address) {
        contract_id -> Text,
        address -> Text,
    }
}

diesel::table! {
    contract_tx (tx_id) {
        tx_id -> Text,
        contract_id -> Text,
        status -> Text,
        effect -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    multisig_contract (contract_id) {
        contract_id -> Text,
        threshold -> Int4,
        #[sql_name = "type"]
        type_ -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    tx_sigs (tx_id, address) {
        tx_id -> Text,
        address -> Text,
        sig -> Text,
        created_at -> Timestamptz,
    }
}

diesel::joinable!(contract_approvers -> approver (address));
diesel::joinable!(contract_approvers -> multisig_contract (contract_id));
diesel::joinable!(contract_tx -> multisig_contract (contract_id));
diesel::joinable!(tx_sigs -> approver (address));
diesel::joinable!(tx_sigs -> contract_tx (tx_id));

diesel::allow_tables_to_appear_in_same_query!(
    approver,
    contract_approvers,
    contract_tx,
    multisig_contract,
    tx_sigs,
);
