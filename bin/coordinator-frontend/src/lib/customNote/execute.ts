import type { AdviceMap, TransactionRequest } from '@miden-sdk/miden-sdk';

import { buildCustomNoteRequest, buildCustomNoteRequestBuilder, type CustomNoteRequestClient } from './request';
import { decodeRecipeLabel, loadRecipe, type CustomNoteRecipe } from './recipe';

/** What this module needs from `Multisig`, narrowed so a test can stand one in. */
export interface CustomExecutionSubmitter {
  prepareCustomExecution(proposalId: string, transactionRequestBytes: Uint8Array): Promise<AdviceMap>;
  submitTransaction(proposalId: string, request: TransactionRequest): Promise<void>;
}

/** What this module needs from a proposal. */
export interface CustomExecutionProposal {
  id: string;
  metadata: { proposalType: string; rawProposalType?: string };
}

export interface BuiltCustomExecutionRequest {
  request: { serialize(): Uint8Array };
}

export interface BuiltCustomExecutionBuilder {
  builder: { extendAdviceMap(advice: AdviceMap): { build(): TransactionRequest } };
}

/**
 * Guardian's custom-execution protocol over two builds of the same pinned recipe, which are
 * byte-identical: the first gives the bytes `prepareCustomExecution` checks against the signed
 * summary and answers with the execution advice; the advice is then folded into a fresh builder
 * and that request is submitted. Two builds because `.build()` consumes a builder.
 */
export async function runCustomExecution(
  ms: CustomExecutionSubmitter,
  recipe: CustomNoteRecipe,
  buildReq: (recipe: CustomNoteRecipe) => Promise<BuiltCustomExecutionRequest>,
  buildBuilder: (recipe: CustomNoteRecipe) => Promise<BuiltCustomExecutionBuilder>,
  proposalId: string,
): Promise<void> {
  const { request } = await buildReq(recipe);
  const advice = await ms.prepareCustomExecution(proposalId, request.serialize());
  const { builder } = await buildBuilder(recipe);
  await ms.submitTransaction(proposalId, builder.extendAdviceMap(advice).build());
}

/** The recipe of a custom-note proposal: this browser's copy when it proposed, else the label's. */
export function customNoteRecipeOf(proposal: CustomExecutionProposal): CustomNoteRecipe | null {
  return loadRecipe(proposal.id) ?? (proposal.metadata.rawProposalType ? decodeRecipeLabel(proposal.metadata.rawProposalType) : null);
}

/**
 * Executes a ready custom-note proposal: resolves its recipe, rebuilds the request, asks for the
 * execution advice and submits the advice-carrying rebuild. Throws before touching Guardian for
 * a custom proposal that is not a custom-note one (another integration's label).
 */
export async function executeCustomNoteProposal(
  ms: CustomExecutionSubmitter,
  client: CustomNoteRequestClient,
  proposal: CustomExecutionProposal,
  run: (recipe: CustomNoteRecipe) => Promise<void> = (recipe) =>
    runCustomExecution(ms, recipe, (r) => buildCustomNoteRequest(client, r), (r) => buildCustomNoteRequestBuilder(client, r), proposal.id),
): Promise<void> {
  const recipe = customNoteRecipeOf(proposal);
  if (!recipe) throw new Error('This is not a custom-note proposal this app can execute: its recipe could not be found.');
  await run(recipe);
}
