import type { AdviceMap, MidenClient, TransactionRequest } from '@miden-sdk/miden-sdk';

import { buildAdminTransactionRequest, buildAdminTransactionRequestBuilder } from './adminRequest';
import { decodeRecipeLabel, loadRecipe, type AdminRecipe } from './recipe';

/** The minimal shape of `Multisig` this module needs — kept narrow so tests can mock it. */
export interface CustomExecutionSubmitter {
  prepareCustomExecution(proposalId: string, transactionRequestBytes: Uint8Array): Promise<AdviceMap>;
  submitTransaction(proposalId: string, request: TransactionRequest): Promise<void>;
}

/** The minimal shape of a proposal this module needs to resolve and execute its recipe. */
export interface CustomExecutionProposal {
  id: string;
  metadata: {
    proposalType: string;
    rawProposalType?: string;
  };
}

/** The minimal shape of an already-built admin transaction request this module needs. */
export interface BuiltCustomExecutionRequest {
  request: { serialize(): Uint8Array };
}

/** The minimal shape of an already-built (pre-`.build()`) admin request builder this module needs. */
export interface BuiltCustomExecutionBuilder {
  builder: { extendAdviceMap(advice: AdviceMap): { build(): TransactionRequest } };
}

/**
 * Runs the custom-execution protocol against already-built request/builder factories.
 *
 * Builds the request TWICE from the same pinned `recipe` — deterministic given its `saltHex` and
 * `boundBlockNum`, so both builds produce byte-identical transaction bytes: once (via `buildReq`)
 * for the bytes `prepareCustomExecution` checks against the signed commitment, and once more (via
 * `buildBuilder`, a *fresh* builder) to fold the returned advice into. A `TransactionRequestBuilder`
 * is consumed by `.build()`, so the same builder instance cannot serve both the pre-advice
 * binding-check bytes and the post-advice final request — see Task 8's `buildAdminTransactionRequestBuilder`
 * doc comment.
 *
 * This is the dependency-injected seam `executeCustomProposal` delegates to: `buildReq`/
 * `buildBuilder` stand in for `buildAdminTransactionRequest`/`buildAdminTransactionRequestBuilder`,
 * which both need a live `MidenClient` and are therefore not exercised by unit tests directly.
 */
export async function runCustomExecution(
  ms: CustomExecutionSubmitter,
  recipe: AdminRecipe,
  buildReq: (recipe: AdminRecipe) => Promise<BuiltCustomExecutionRequest>,
  buildBuilder: (recipe: AdminRecipe) => Promise<BuiltCustomExecutionBuilder>,
  proposalId: string,
): Promise<void> {
  const { request } = await buildReq(recipe);
  const advice = await ms.prepareCustomExecution(proposalId, request.serialize());

  const { builder } = await buildBuilder(recipe);
  await ms.submitTransaction(proposalId, builder.extendAdviceMap(advice).build());
}

/**
 * Executes a CUSTOM admin proposal: resolves its recipe (preferring the proposer's own local
 * cache, falling back to decoding it off the note label so any signer can execute), rebuilds the
 * deterministic request from it, asks for execution advice via `prepareCustomExecution`, folds
 * that advice into a freshly-rebuilt request (a fresh builder — see `runCustomExecution`), and
 * submits it.
 *
 * Needs a live `MidenClient`/account to build against, so this is not unit-tested end to end here
 * (covered by the Task 14 e2e suite) beyond the recipe-resolution guard, which runs before either
 * build. `runCustomExecution`, which this delegates to, is the unit-tested protocol seam.
 */
export async function executeCustomProposal(
  ms: CustomExecutionSubmitter,
  client: MidenClient,
  proposal: CustomExecutionProposal,
): Promise<void> {
  const recipe =
    loadRecipe(proposal.id) ??
    (proposal.metadata.rawProposalType ? decodeRecipeLabel(proposal.metadata.rawProposalType) : null);
  if (!recipe) {
    throw new Error('Cannot reconstruct the admin proposal recipe');
  }

  await runCustomExecution(
    ms,
    recipe,
    (r) => buildAdminTransactionRequest(client, r),
    (r) => buildAdminTransactionRequestBuilder(client, r),
    proposal.id,
  );
}
