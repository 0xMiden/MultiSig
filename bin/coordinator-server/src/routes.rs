use axum::{Json, extract::State, http::StatusCode};
use itertools::Itertools;
use miden_client::{
    Word,
    account::AccountId,
    address::{Address, AddressId, NetworkId},
    utils::{Deserializable, Serializable},
};
use miden_multisig_coordinator_engine::{
    request::{
        AddSignatureRequest, CreateMultisigAccountRequest, GetConsumableNotesRequest,
        GetMultisigAccountRequest, GetMultisigTxStatsRequest, ListMultisigApproverRequest,
        ListMultisigTxRequest, ProposeMultisigTxRequest, RequestError,
    },
    response::{
        CreateMultisigAccountResponse, CreateMultisigAccountResponseDissolved,
        GetMultisigAccountResponseDissolved, GetMultisigTxStatsResponseDissolved,
        ListMultisigApproverResponseDissolved, ListMultisigTxResponse,
        ListMultisigTxResponseDissolved, ProposeMultisigTxResponseDissolved,
    },
};
use tokio::task;

use crate::{
    App, AppDissolved,
    error::AppError,
    payload::{
        request::{
            AddSignatureRequestPayload, AddSignatureRequestPayloadDissolved,
            CreateMultisigAccountRequestPayload, CreateMultisigAccountRequestPayloadDissolved,
            GetMultisigAccountDetailsRequestPayload,
            GetMultisigAccountDetailsRequestPayloadDissolved, GetMultisigTxStatsRequestPayload,
            GetMultisigTxStatsRequestPayloadDissolved, ListConsumableNotesRequestPayload,
            ListConsumableNotesRequestPayloadDissolved, ListMultisigApproverRequestPayload,
            ListMultisigApproverRequestPayloadDissolved, ListMultisigTxRequestPayload,
            ListMultisigTxRequestPayloadDissolved, ProposeMultisigTxRequestPayload,
            ProposeMultisigTxRequestPayloadDissolved,
        },
        response::{
            AddSignatureResponsePayload, CreateMultisigAccountResponsePayload,
            GetMultisigAccountDetailsResponsePayload, GetMultisigTxStatsResponsePayload,
            ListConsumableNotesResponsePayload, ListMultisigApproverResponsePayload,
            ListMultisigTxResponsePayload, ProposeMultisigTxResponsePayload,
        },
    },
};

#[tracing::instrument]
pub async fn health() -> StatusCode {
    StatusCode::OK
}

#[tracing::instrument(skip_all)]
pub async fn create_multisig_account(
    State(app): State<App>,
    Json(payload): Json<CreateMultisigAccountRequestPayload>,
) -> Result<Json<CreateMultisigAccountResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let CreateMultisigAccountRequestPayloadDissolved { threshold, approvers, pub_key_commits } =
        payload.dissolve();

    let engine_network_id = engine.network_id().clone();
    let CreateMultisigAccountResponseDissolved { multisig_account, .. } =
        task::spawn_blocking(move || {
            let approvers = approvers
                .iter()
                .map(AsRef::as_ref)
                .map(decode_account_address)
                .map_ok(|(network_id, account_id)| {
                    engine_network_id
                        .eq(&network_id)
                        .then_some(account_id)
                        .ok_or(AppError::InvalidNetworkId)
                })
                .map(Result::flatten)
                .try_collect()
                .inspect_err(|e| tracing::error!("failed to decode approvers: {e}"))?;

            let pub_key_commits = pub_key_commits
                .iter()
                .map(AsRef::as_ref)
                .map(Word::read_from_bytes)
                .map_ok(From::from)
                .try_collect()
                .map_err(|_| AppError::InvalidPubKeyCommit)
                .inspect_err(|e| tracing::error!("failed to decode public key commitments: {e}"))?;

            CreateMultisigAccountRequest::builder()
                .threshold(threshold)
                .approvers(approvers)
                .pub_key_commits(pub_key_commits)
                .build()
                .map_err(RequestError::from)
                .map_err(AppError::from)
                .inspect_err(|e| tracing::error!("failed to create request: {e}"))
        })
        .await?
        .map(|request| engine.create_multisig_account(request))?
        .await
        .map(CreateMultisigAccountResponse::dissolve)
        .inspect_err(|e| tracing::error!("failed to create multisig account: {e}"))?;

    let response = CreateMultisigAccountResponsePayload::builder()
        .address(multisig_account.account_id().to_bech32(multisig_account.network_id().clone()))
        .created_at(multisig_account.aux().created_at())
        .updated_at(multisig_account.aux().updated_at())
        .build();

    Ok(Json(response))
}

#[tracing::instrument(skip_all)]
pub async fn propose_multisig_tx(
    State(app): State<App>,
    Json(payload): Json<ProposeMultisigTxRequestPayload>,
) -> Result<Json<ProposeMultisigTxResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let ProposeMultisigTxRequestPayloadDissolved { multisig_account_address, tx_request } =
        payload.dissolve();

    let request = {
        let account_id = decode_account_address(&multisig_account_address)
            .map(|(network_id, account_id)| {
                engine.network_id().eq(&network_id).then_some(account_id)
            })?
            .ok_or(AppError::InvalidNetworkId)?;

        let tx_request = Deserializable::read_from_bytes(&tx_request)
            .map_err(|_| AppError::InvalidTransactionRequest)?;

        ProposeMultisigTxRequest::builder()
            .multisig_account_id(account_id)
            .tx_request(tx_request)
            .build()
    };

    let ProposeMultisigTxResponseDissolved { tx_id, tx_summary } =
        engine.propose_multisig_tx(request).await?.dissolve();

    let response = ProposeMultisigTxResponsePayload::builder()
        .tx_id(tx_id.into())
        .tx_summary(tx_summary.to_bytes())
        .build();

    Ok(Json(response))
}

#[tracing::instrument(skip_all)]
pub async fn add_signature(
    State(app): State<App>,
    Json(payload): Json<AddSignatureRequestPayload>,
) -> Result<Json<AddSignatureResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let AddSignatureRequestPayloadDissolved { tx_id, approver, signature } = payload.dissolve();

    let request = {
        let approver = decode_account_address(&approver)
            .map(|(network_id, account_id)| {
                engine.network_id().eq(&network_id).then_some(account_id)
            })?
            .ok_or(AppError::InvalidNetworkId)?;

        let signature =
            Deserializable::read_from_bytes(&signature).map_err(|_| AppError::InvalidSignature)?;

        AddSignatureRequest::builder()
            .tx_id(tx_id.into())
            .approver(approver)
            .signature(signature)
            .build()
    };

    let tx_result = engine.add_signature(request).await?.as_ref().map(Serializable::to_bytes);

    let response = AddSignatureResponsePayload::builder().maybe_tx_result(tx_result).build();

    Ok(Json(response))
}

#[tracing::instrument(skip_all)]
pub async fn list_consumable_notes(
    State(app): State<App>,
    Json(payload): Json<ListConsumableNotesRequestPayload>,
) -> Result<Json<ListConsumableNotesResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let ListConsumableNotesRequestPayloadDissolved { address } = payload.dissolve();

    let account_id = address
        .as_deref()
        .map(decode_account_address)
        .transpose()?
        .map(|(network_id, account_id)| {
            engine
                .network_id()
                .eq(&network_id)
                .then_some(account_id)
                .ok_or(AppError::InvalidNetworkId)
        })
        .transpose()?;

    let request = GetConsumableNotesRequest::builder().maybe_account_id(account_id).build();

    let note_ids = engine
        .get_consumable_notes(request)
        .await?
        .into_iter()
        .map(|(input_note_record, _)| input_note_record.id().into())
        .collect();

    let response = ListConsumableNotesResponsePayload::builder().note_ids(note_ids).build();

    Ok(Json(response))
}

#[tracing::instrument(skip_all)]
pub async fn get_multisig_account_details(
    State(app): State<App>,
    Json(payload): Json<GetMultisigAccountDetailsRequestPayload>,
) -> Result<Json<GetMultisigAccountDetailsResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let GetMultisigAccountDetailsRequestPayloadDissolved { multisig_account_address } =
        payload.dissolve();

    let multisig_account_id = decode_account_address(&multisig_account_address)
        .map(|(network_id, account_id)| engine.network_id().eq(&network_id).then_some(account_id))?
        .ok_or(AppError::InvalidNetworkId)?;

    let request = GetMultisigAccountRequest::builder()
        .multisig_account_id(multisig_account_id)
        .build();

    let GetMultisigAccountResponseDissolved { multisig_account } =
        engine.get_multisig_account(request).await?.dissolve();

    let multisig_account = multisig_account.ok_or(AppError::MultisigAccountNotFound)?;

    let response = GetMultisigAccountDetailsResponsePayload::builder()
        .multisig_account(multisig_account.into())
        .build();

    Ok(Json(response))
}

#[tracing::instrument(skip_all)]
pub async fn list_multisig_approvers(
    State(app): State<App>,
    Json(payload): Json<ListMultisigApproverRequestPayload>,
) -> Result<Json<ListMultisigApproverResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let ListMultisigApproverRequestPayloadDissolved { multisig_account_address } =
        payload.dissolve();

    let multisig_account_id = decode_account_address(&multisig_account_address)
        .map(|(network_id, account_id)| engine.network_id().eq(&network_id).then_some(account_id))?
        .ok_or(AppError::InvalidNetworkId)?;

    let request = ListMultisigApproverRequest::builder()
        .multisig_account_id(multisig_account_id)
        .build();

    let ListMultisigApproverResponseDissolved { approvers } =
        engine.list_multisig_approvers(request).await?.dissolve();

    let response = ListMultisigApproverResponsePayload::builder()
        .approvers(approvers.into_iter().map(From::from).collect())
        .build();

    Ok(Json(response))
}

pub async fn get_multisig_tx_stats(
    State(app): State<App>,
    Json(payload): Json<GetMultisigTxStatsRequestPayload>,
) -> Result<Json<GetMultisigTxStatsResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let GetMultisigTxStatsRequestPayloadDissolved { multisig_account_address } = payload.dissolve();

    let multisig_account_id = decode_account_address(&multisig_account_address)
        .map(|(network_id, account_id)| engine.network_id().eq(&network_id).then_some(account_id))?
        .ok_or(AppError::InvalidNetworkId)?;

    let request = GetMultisigTxStatsRequest::builder()
        .multisig_account_id(multisig_account_id)
        .build();

    let GetMultisigTxStatsResponseDissolved { tx_stats } =
        engine.get_multisig_tx_stats(request).await?.dissolve();

    let response = GetMultisigTxStatsResponsePayload::builder().tx_stats(tx_stats).build();

    Ok(Json(response))
}

#[tracing::instrument(skip_all)]
pub async fn list_multisig_tx(
    State(app): State<App>,
    Json(payload): Json<ListMultisigTxRequestPayload>,
) -> Result<Json<ListMultisigTxResponsePayload>, AppError> {
    let AppDissolved { engine } = app.dissolve();

    let ListMultisigTxRequestPayloadDissolved {
        multisig_account_address,
        tx_status_filter,
    } = payload.dissolve();

    let multisig_account_id = decode_account_address(&multisig_account_address)
        .map(|(network_id, account_id)| engine.network_id().eq(&network_id).then_some(account_id))?
        .ok_or(AppError::InvalidNetworkId)?;

    let tx_status_filter = tx_status_filter
        .as_deref()
        .map(TryFrom::try_from)
        .transpose()
        .map_err(|_| AppError::InvalidMultisigTxStatus)?;

    let request = ListMultisigTxRequest::builder()
        .multisig_account_id(multisig_account_id)
        .maybe_tx_status_filter(tx_status_filter)
        .build();

    let ListMultisigTxResponseDissolved { txs } =
        engine.list_multisig_tx(request).await.map(ListMultisigTxResponse::dissolve)?;

    let response = ListMultisigTxResponsePayload::builder()
        .txs(txs.into_iter().map(From::from).collect())
        .build();

    Ok(Json(response))
}

fn decode_account_address(address: &str) -> Result<(NetworkId, AccountId), AppError> {
    let (network_id, address) = Address::decode(address)
        .map_err(|e| AppError::other(format!("failed to decode address: {e}")))?;

    match address.id() {
        AddressId::AccountId(account_id) => Ok((network_id, account_id)),
        _ => Err(AppError::other("address must be account id")),
    }
}
