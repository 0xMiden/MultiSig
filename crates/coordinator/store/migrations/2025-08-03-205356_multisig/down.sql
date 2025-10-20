-- This file should undo anything in `up.sql`

DROP TABLE IF EXISTS multisig_account CASCADE;
DROP TABLE IF EXISTS approver CASCADE;
DROP TABLE IF EXISTS multisig_account_approver_mapping CASCADE;
DROP TABLE IF EXISTS tx CASCADE;
DROP TABLE IF EXISTS signature CASCADE;
DROP TYPE IF EXISTS account_kind;
DROP TYPE IF EXISTS tx_status;
