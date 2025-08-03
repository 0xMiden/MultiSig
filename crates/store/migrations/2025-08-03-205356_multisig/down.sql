-- This file should undo anything in `up.sql`

DROP TABLE IF EXISTS multisig_contract CASCADE;
DROP TABLE IF EXISTS approver CASCADE;
DROP TABLE IF EXISTS contract_tx CASCADE;
DROP TABLE IF EXISTS contract_approvers CASCADE;
DROP TABLE IF EXISTS tx_sigs CASCADE;
