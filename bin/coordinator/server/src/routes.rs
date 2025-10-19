use axum::{Json, extract::State};
use itertools::Itertools;
use miden_client::{
    Word,
    account::{AccountIdAddress, Address, NetworkId},
    utils::{Deserializable, Serializable},
};
use miden_multisig_coordinator_engine::{
    request::{
        AddSignatureRequest, CreateMultisigAccountRequest, GetMultisigAccountRequest,
        ListMultisigTxRequest, ProposeMultisigTxRequest, RequestError,
    },
    response::{
        CreateMultisigAccountResponse, CreateMultisigAccountResponseDissolved,
        GetMultisigAccountResponseDissolved, ListMultisigTxResponse,
        ListMultisigTxResponseDissolved, ProposeMultisigTxResponseDissolved,
    },
};
use miden_objects::crypto::dsa::rpo_falcon512::PublicKey;
use tokio::task;

use crate::{
    App, AppDissolved,
    error::AppError,
    payload::{
        request::{
            AddSignatureRequestPayload, AddSignatureRequestPayloadDissolved,
            CreateMultisigAccountRequestPayload, CreateMultisigAccountRequestPayloadDissolved,
            GetMultisigAccountDetailsRequestPayload,
            GetMultisigAccountDetailsRequestPayloadDissolved, ListMultisigTxRequestPayload,
            ListMultisigTxRequestPayloadDissolved, ProposeMultisigTxRequestPayload,
            ProposeMultisigTxRequestPayloadDissolved,
        },
        response::{
            AddSignatureResponsePayload, CreateMultisigAccountResponsePayload,
            GetMultisigAccountDetailsResponsePayload, ListMultisigTxResponsePayload,
            ProposeMultisigTxResponsePayload,
        },
    },
};

#[tracing::instrument(skip(app))]
pub async fn create_multisig_account(
    State(app): State<App>,
    Json(payload): Json<CreateMultisigAccountRequestPayload>,
) -> Result<Json<CreateMultisigAccountResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let CreateMultisigAccountRequestPayloadDissolved { threshold, approvers, pub_key_commits } =
        payload.dissolve();

    let engine_network_id = engine.network_id();
    let CreateMultisigAccountResponseDissolved { multisig_account, .. } =
        task::spawn_blocking(move || {
            let approvers = approvers
                .iter()
                .map(AsRef::as_ref)
                .map(extract_network_id_account_id_address_pair)
                .map_ok(|(network_id, account_id_address)| {
                    engine_network_id
                        .eq(&network_id)
                        .then_some(account_id_address)
                        .ok_or(AppError::InvalidNetworkId)
                })
                .map(Result::flatten)
                .try_collect()?;

            let pub_key_commits = pub_key_commits
                .iter()
                .map(AsRef::as_ref)
                .map(Word::read_from_bytes)
                .map_ok(PublicKey::new)
                .try_collect()
                .map_err(|_| AppError::InvalidPubKeyCommit)?;

            CreateMultisigAccountRequest::builder()
                .threshold(threshold)
                .approvers(approvers)
                .pub_key_commits(pub_key_commits)
                .build()
                .map_err(RequestError::from)
                .map_err(AppError::from)
        })
        .await?
        .map(|request| engine.create_multisig_account(request))?
        .await
        .map(CreateMultisigAccountResponse::dissolve)?;

    let response = CreateMultisigAccountResponsePayload::builder()
        .address(
            Address::AccountId(multisig_account.address()).to_bech32(multisig_account.network_id()),
        )
        .created_at(multisig_account.aux().created_at())
        .updated_at(multisig_account.aux().updated_at())
        .build();

    Ok(Json(response))
}

pub async fn propose_multisig_tx(
    State(app): State<App>,
    Json(payload): Json<ProposeMultisigTxRequestPayload>,
) -> Result<Json<ProposeMultisigTxResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let ProposeMultisigTxRequestPayloadDissolved { address, tx_request } = payload.dissolve();

    let request = {
        let account_id_address = extract_network_id_account_id_address_pair(&address)
            .map(|(network_id, address)| engine.network_id().eq(&network_id).then_some(address))?
            .ok_or(AppError::InvalidNetworkId)?;

        let tx_request = Deserializable::read_from_bytes(&tx_request)
            .map_err(|_| AppError::InvalidTransactionRequest)?;

        ProposeMultisigTxRequest::builder()
            .address(account_id_address)
            .tx_request(tx_request)
            .build()
    };

    let ProposeMultisigTxResponseDissolved { tx_id, tx_summary } =
        engine.propose_multisig_tx(request).await?.dissolve();

    let response = ProposeMultisigTxResponsePayload::builder()
        .tx_id(tx_id.into())
        .tx_summary(tx_summary.to_bytes().into())
        .build();

    Ok(Json(response))
}

pub async fn add_signature(
    State(app): State<App>,
    Json(payload): Json<AddSignatureRequestPayload>,
) -> Result<Json<AddSignatureResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let AddSignatureRequestPayloadDissolved { tx_id, approver, signature } = payload.dissolve();

    let request = {
        let approver = extract_network_id_account_id_address_pair(&approver)
            .map(|(network_id, address)| engine.network_id().eq(&network_id).then_some(address))?
            .ok_or(AppError::InvalidNetworkId)?;

        let signature =
            Deserializable::read_from_bytes(&signature).map_err(|_| AppError::InvalidSignature)?;

        AddSignatureRequest::builder()
            .tx_id(tx_id.into())
            .approver(approver)
            .signature(signature)
            .build()
    };

    let tx_result = engine
        .add_signature(request)
        .await?
        .as_ref()
        .map(Serializable::to_bytes)
        .map(From::from);

    let response = AddSignatureResponsePayload::builder().maybe_tx_result(tx_result).build();

    Ok(Json(response))
}

pub async fn get_multisig_account_details(
    State(app): State<App>,
    Json(payload): Json<GetMultisigAccountDetailsRequestPayload>,
) -> Result<Json<GetMultisigAccountDetailsResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let GetMultisigAccountDetailsRequestPayloadDissolved { multisig_account_address } =
        payload.dissolve();

    let multisig_account_id_address =
        extract_network_id_account_id_address_pair(&multisig_account_address)
            .map(|(network_id, address)| engine.network_id().eq(&network_id).then_some(address))?
            .ok_or(AppError::InvalidNetworkId)?;

    let request = GetMultisigAccountRequest::builder()
        .multisig_account_id_address(multisig_account_id_address)
        .build();

    let GetMultisigAccountResponseDissolved { multisig_account } =
        engine.get_multisig_account(request).await?.dissolve();

    let multisig_account = multisig_account.ok_or(AppError::MultisigAccountNotFound)?;

    let response = GetMultisigAccountDetailsResponsePayload::builder()
        .multisig_account(multisig_account.into())
        .build();

    Ok(Json(response))
}

pub async fn list_multisig_tx(
    State(app): State<App>,
    Json(payload): Json<ListMultisigTxRequestPayload>,
) -> Result<Json<ListMultisigTxResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let ListMultisigTxRequestPayloadDissolved {
        multisig_account_address,
        tx_status_filter,
    } = payload.dissolve();

    let multisig_account_id_address =
        extract_network_id_account_id_address_pair(&multisig_account_address)
            .map(|(network_id, address)| engine.network_id().eq(&network_id).then_some(address))?
            .ok_or(AppError::InvalidNetworkId)?;

    let tx_status_filter = tx_status_filter
        .as_deref()
        .map(TryFrom::try_from)
        .transpose()
        .map_err(|_| AppError::InvalidMultisigTxStatus)?;

    let request = ListMultisigTxRequest::builder()
        .multisig_account_id_address(multisig_account_id_address)
        .maybe_tx_status_filter(tx_status_filter)
        .build();

    let ListMultisigTxResponseDissolved { txs } =
        engine.list_multisig_tx(request).await.map(ListMultisigTxResponse::dissolve)?;

    let response = ListMultisigTxResponsePayload::builder()
        .txs(txs.into_iter().map(From::from).collect())
        .build();

    Ok(Json(response))
}

fn extract_network_id_account_id_address_pair(
    bech32: &str,
) -> Result<(NetworkId, AccountIdAddress), AppError> {
    let (network_id, Address::AccountId(address)) = Address::from_bech32(bech32)
        .map_err(|_| AppError::invalid_account_id_address(bech32.to_string()))?
    else {
        return Err(AppError::invalid_account_id_address(bech32.to_string()));
    };

    Ok((network_id, address))
}
