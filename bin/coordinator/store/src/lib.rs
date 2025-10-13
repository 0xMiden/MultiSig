//! This crate defines the interactions with the persistence layer i.e. the database.

mod errors;
mod persistence;

pub use self::{errors::MultisigStoreError, persistence::pool::establish_pool};

use core::num::NonZeroU32;

use diesel_async::AsyncConnection;
use itertools::Itertools;
use miden_client::{
    Word,
    account::{AccountIdAddress, AccountStorageMode, Address, NetworkId},
    transaction::TransactionRequest,
    utils::{Deserializable, Serializable},
};
use miden_multisig_coordinator_domain::{
    MultisigAccount, Timestamps,
    tx::{MultisigTx, MultisigTxId, MultisigTxStatus},
};
use miden_objects::{
    crypto::dsa::rpo_falcon512::{PublicKey, Signature},
    transaction::TransactionSummary,
};
use oblux::U63;

use self::{
    errors::Result,
    persistence::{
        pool::{DbConn, DbPool},
        record::{
            insert::{
                NewApproverRecord, NewMultisigAccountRecord, NewSignatureRecord, NewTxRecord,
            },
            select::{
                ApproverRecord, ApproverRecordDissolved, MultisigAccountRecord,
                MultisigAccountRecordDissolved, TxRecord, TxRecordDissolved,
            },
        },
        store::{self, StoreError},
    },
};

/// Represents a connection pool with PostgreSQL database for multisig operations.
pub struct MultisigStore {
    pool: DbPool,
}

impl MultisigStore {
    /// Returns a new instance of [MultisigStore] with the specified database URL.
    pub async fn new(pool: DbPool) -> Self {
        MultisigStore { pool }
    }
}

impl MultisigStore {
    pub async fn create_multisig_account(
        &self,
        network_id: NetworkId,
        multisig_account_id_address: AccountIdAddress,
        kind: AccountStorageMode,
        threshold: NonZeroU32,
        approvers: Vec<(AccountIdAddress, PublicKey)>,
    ) -> Result<()> {
        self.get_conn()
            .await?
            .transaction(|conn| {
                Box::pin(async move {
                    let multisig_account_address =
                        Address::AccountId(multisig_account_id_address).to_bech32(network_id);

                    let new_multisig_account = NewMultisigAccountRecord::builder()
                        .address(&multisig_account_address)
                        .kind(kind.into())
                        .threshold(threshold.get().into())
                        .build();

                    store::save_new_multisig_account(conn, new_multisig_account).await?;

                    for (approver_account_id_address, pub_key_commit) in approvers {
                        let approver_address =
                            Address::AccountId(approver_account_id_address).to_bech32(network_id);

                        let pub_key_commit_bz = Word::from(pub_key_commit).as_bytes();

                        let new_approver = NewApproverRecord::builder()
                            .address(&approver_address)
                            .pub_key_commit(&pub_key_commit_bz)
                            .build();

                        store::upsert_approver(conn, new_approver).await?;

                        store::save_new_multisig_account_approver_mapping(
                            conn,
                            &multisig_account_address,
                            &approver_address,
                        )
                        .await?;
                    }

                    Ok(())
                })
            })
            .await
            .map_err(MultisigStoreError::Store)?;

        Ok(())
    }

    pub async fn create_multisig_tx(
        &self,
        network_id: NetworkId,
        account_id_address: AccountIdAddress,
        tx_request: &TransactionRequest,
        tx_summary: &TransactionSummary,
    ) -> Result<MultisigTxId> {
        let multisig_account_address = Address::AccountId(account_id_address).to_bech32(network_id);

        let tx_request_bz = tx_request.to_bytes();
        let tx_summary_bz = tx_summary.to_bytes();
        let tx_summary_commit_bz = tx_summary.to_commitment().as_bytes();

        let new_tx = NewTxRecord::builder()
            .multisig_account_address(&multisig_account_address)
            .tx_request(&tx_request_bz)
            .tx_summary(&tx_summary_bz)
            .tx_summary_commit(&tx_summary_commit_bz)
            .build();

        store::save_new_tx(&mut self.get_conn().await?, new_tx)
            .await
            .map(From::from)
            .map_err(From::from)
    }

    pub async fn add_multisig_tx_signature(
        &self,
        tx_id: &MultisigTxId,
        network_id: NetworkId,
        approver_account_id_address: AccountIdAddress,
        signature: &Signature,
    ) -> Result<Option<bool>> {
        self.get_conn()
            .await?
            .transaction(|conn| {
                Box::pin(async move {
                    let approver_address =
                        Address::AccountId(approver_account_id_address).to_bech32(network_id);

                    if !store::validate_approver_address_by_tx_id(
                        conn,
                        tx_id.into(),
                        &approver_address,
                    )
                    .await?
                    {
                        return Ok(None);
                    }

                    let signature_bz = signature.to_bytes();

                    let new_signature = NewSignatureRecord::builder()
                        .tx_id(tx_id.into())
                        .approver_address(&approver_address)
                        .signature_bytes(&signature_bz)
                        .build();

                    store::save_new_signature(conn, new_signature).await?;

                    let (tx_record, signature_count) =
                        store::fetch_tx_with_signature_count_by_id(conn, tx_id.into())
                            .await?
                            .ok_or(StoreError::other("tx not found"))?;

                    let TxRecordDissolved { multisig_account_address, .. } = tx_record.dissolve();

                    let MultisigAccountRecordDissolved { threshold, .. } =
                        store::fetch_mutisig_account_by_address(conn, &multisig_account_address)
                            .await?
                            .map(MultisigAccountRecord::dissolve)
                            .ok_or(StoreError::other("multisig account not found"))?;

                    Ok(Some(signature_count.to_signed() >= threshold))
                })
            })
            .await
            .map_err(MultisigStoreError::Store)
    }

    pub async fn update_multisig_tx_status_by_id(
        &self,
        tx_id: &MultisigTxId,
        new_status: MultisigTxStatus,
    ) -> Result<()> {
        let conn = &mut self.get_conn().await?;

        if !store::update_status_by_tx_id(conn, tx_id.into(), new_status.into()).await? {
            return Err(MultisigStoreError::NotFound("tx id not found".into()));
        }

        Ok(())
    }

    pub async fn get_multisig_account(
        &self,
        network_id: NetworkId,
        account_id_address: AccountIdAddress,
    ) -> Result<Option<MultisigAccount>> {
        let conn = &mut self.get_conn().await?;

        let address = Address::AccountId(account_id_address).to_bech32(network_id);

        let Some(MultisigAccountRecordDissolved { address, kind, threshold, created_at }) =
            store::fetch_mutisig_account_by_address(conn, &address)
                .await?
                .map(MultisigAccountRecord::dissolve)
        else {
            return Ok(None);
        };

        let approvers = store::fetch_approvers_by_multisig_account_address(conn, &address)
            .await?
            .into_iter()
            .map(ApproverRecord::dissolve)
            .map(|ApproverRecordDissolved { address, .. }| address)
            .map(|a| extract_network_id_account_id_address_pair(&a))
            .map_ok(|(_, approver_address)| approver_address)
            .try_collect()?;

        let threshold = threshold
            .try_into()
            .map(NonZeroU32::new)
            .map_err(|_| MultisigStoreError::InvalidValue)?
            .ok_or(MultisigStoreError::InvalidValue)?;

        let timestamps =
            Timestamps::builder().created_at(created_at).updated_at(created_at).build();

        let multisig_account = MultisigAccount::builder()
            .address(account_id_address)
            .network_id(network_id)
            .kind(kind.into_inner())
            .approvers(approvers)
            .threshold(threshold)
            .aux(timestamps)
            .build();

        Ok(Some(multisig_account))
    }

    pub async fn get_txs_by_multisig_account_address_with_status_filter<S>(
        &self,
        network_id: NetworkId,
        address: AccountIdAddress,
        tx_status_filter: S,
    ) -> Result<Vec<MultisigTx>>
    where
        Option<MultisigTxStatus>: From<S>,
    {
        let conn = &mut self.get_conn().await?;

        let address = Address::AccountId(address).to_bech32(network_id);

        let tx_records_with_sigs_count = match tx_status_filter.into() {
            Some(status) => {
                store::fetch_txs_with_signature_count_by_multisig_account_address_and_status(
                    conn,
                    &address,
                    status.into(),
                )
                .await?
            },
            None => {
                store::fetch_txs_with_signature_count_by_multisig_account_address(conn, &address)
                    .await?
            },
        };

        tx_records_with_sigs_count
            .into_iter()
            .map(|(tx_record, sigs_count)| make_multisig_tx(tx_record, sigs_count))
            .collect()
    }

    pub async fn get_multisig_tx_by_id(&self, id: &MultisigTxId) -> Result<Option<MultisigTx>> {
        store::fetch_tx_with_signature_count_by_id(&mut self.get_conn().await?, id.into())
            .await?
            .map(|(tx_record, sigs_count)| make_multisig_tx(tx_record, sigs_count))
            .transpose()
    }

    async fn get_conn(&self) -> Result<DbConn> {
        self.pool.get().await.map_err(|_| MultisigStoreError::Pool)
    }
}

fn make_multisig_tx(tx_record: TxRecord, signature_count: U63) -> Result<MultisigTx> {
    let TxRecordDissolved {
        id,
        multisig_account_address,
        status,
        tx_request,
        tx_summary,
        tx_summary_commit,
        created_at,
    } = tx_record.dissolve();

    let (network_id, address) =
        extract_network_id_account_id_address_pair(&multisig_account_address)?;

    let tx_request = TransactionRequest::read_from_bytes(&tx_request)
        .map_err(|_| MultisigStoreError::InvalidValue)?;

    let tx_summary = TransactionSummary::read_from_bytes(&tx_summary)
        .map_err(|_| MultisigStoreError::InvalidValue)?;

    let tx_summary_commit =
        Word::read_from_bytes(&tx_summary_commit).map_err(|_| MultisigStoreError::InvalidValue)?;

    let timestamps = Timestamps::builder().created_at(created_at).updated_at(created_at).build();

    let signature_count = signature_count
        .get()
        .try_into()
        .map(NonZeroU32::new)
        .map_err(|_| MultisigStoreError::InvalidValue)?;

    let tx = MultisigTx::builder()
        .id(id.into())
        .address(address)
        .network_id(network_id)
        .status(status.into_inner())
        .tx_request(tx_request)
        .tx_summary(tx_summary)
        .tx_summary_commit(tx_summary_commit)
        .maybe_signature_count(signature_count)
        .aux(timestamps)
        .build();

    Ok(tx)
}

fn extract_network_id_account_id_address_pair(
    bech32: &str,
) -> Result<(NetworkId, AccountIdAddress)> {
    let (network_id, Address::AccountId(address)) =
        Address::from_bech32(bech32).map_err(|_| MultisigStoreError::InvalidValue)?
    else {
        return Err(MultisigStoreError::Other("address must be account id address".into()));
    };

    Ok((network_id, address))
}
