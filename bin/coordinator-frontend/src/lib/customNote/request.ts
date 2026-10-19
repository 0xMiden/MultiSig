import {
  AccountId,
  AccountStorageRequirements,
  ForeignAccount,
  ForeignAccountArray,
  Note,
  NoteArray,
  NoteType,
  Word,
  type TransactionRequest,
  type TransactionRequestBuilder,
} from '@miden-sdk/miden-sdk';
import { requestBoundBlockNum, requestSaltHex } from '@openzeppelin/miden-multisig-client';

import { encodeRecipeLabel, noteToHex, recipeNoteBytes, saveRecipe, type CustomNoteRecipe } from './recipe';

// Goldilocks field modulus: `Word` takes four canonical field elements, each below it.
const FIELD_P = 0xffffffff00000001n;

/** A fresh, uniformly random salt the multisig summary binds; always a valid `Word`. */
export function freshSaltWord(): Word {
  const limbs = new BigUint64Array(4);
  crypto.getRandomValues(limbs);
  for (let i = 0; i < limbs.length; i++) limbs[i] = limbs[i] % FIELD_P;
  return new Word(limbs);
}

/** What this module needs from the SDK client, narrowed so a test can stand one in. */
export interface CustomNoteRequestClient {
  sync(): Promise<unknown>;
  feeAwareTransactionRequestBuilder(
    accountId: string,
    options: { feeConversionSalt: Word; boundBlockNum?: number },
  ): Promise<TransactionRequestBuilder>;
}

export interface DraftOptions {
  /** Public accounts the transaction reads through foreign-procedure invocation. */
  foreignAccountIds?: string[];
  /** A short, free-form purpose for the proposal list. */
  description?: string;
}

/**
 * The recipe of a proposal that sends `note` from the multisig `senderAccountId`, with the auth
 * arguments still unpinned: the first build draws the salt and binds the block.
 *
 * Only a public note: the private-note guard delivers a private note to the recipient it reads
 * off a P2ID note and knows no other, so a private custom note would be undeliverable and
 * block the account after it executes.
 */
export function draftRecipe(note: Note, senderAccountId: string, options: DraftOptions = {}): CustomNoteRecipe {
  if (note.metadata().noteType() !== NoteType.Public) {
    throw new Error('A custom note must be public: the app cannot deliver a private note whose recipient it does not know.');
  }
  return {
    recipeVersion: 1,
    senderAccountId,
    noteHex: noteToHex(note),
    foreignAccountIds: [...(options.foreignAccountIds ?? [])],
    ...(options.description !== undefined ? { description: options.description } : {}),
    saltHex: '',
    boundBlockNum: 0,
  };
}

/**
 * The `TransactionRequestBuilder` of a custom-note proposal, not yet built: the SDK's
 * multisig-aware builder with the recipe's salt and bound block, the foreign accounts the
 * note needs, and the note as the transaction's own output. Deterministic in the recipe once
 * the salt and block are pinned, which is what lets every cosigner rebuild the signed request.
 * Exposed apart from `buildCustomNoteRequest` because execution folds advice into a fresh
 * builder before building (see `runCustomExecution`).
 *
 * Nothing may call `.withAuthArg()` or `.withFeeConversionSalt()` on the result: either
 * replaces the multisig auth arguments the fee-aware builder attached.
 */
export async function buildCustomNoteRequestBuilder(
  client: CustomNoteRequestClient,
  recipe: CustomNoteRecipe,
): Promise<{ builder: TransactionRequestBuilder; recipe: CustomNoteRecipe }> {
  // At the tip, so the foreign accounts the executor loads exist at the referenced block; a
  // transient sync failure is not this build's problem, the build reports real ones.
  await client.sync().catch(() => undefined);

  const saltWord = recipe.saltHex ? Word.fromHex(recipe.saltHex) : freshSaltWord();
  // Read before the call: the `Word` moves across the wasm boundary and is spent by it.
  const saltHex = saltWord.toHex();
  const builder = await client.feeAwareTransactionRequestBuilder(recipe.senderAccountId, {
    feeConversionSalt: saltWord,
    boundBlockNum: recipe.boundBlockNum || undefined,
  });

  const full: CustomNoteRecipe = { ...recipe, saltHex };
  const note = Note.deserialize(recipeNoteBytes(full));
  let withNote = builder;
  if (full.foreignAccountIds.length > 0) {
    // The web client does not load the accounts a transaction reads through FPI on demand;
    // whole accounts, no storage requirements, as the executor loads them.
    const foreign = full.foreignAccountIds.map((id) => ForeignAccount.public(AccountId.fromHex(id), new AccountStorageRequirements()));
    withNote = withNote.withForeignAccounts(new ForeignAccountArray(foreign));
  }
  withNote = withNote.withOwnOutputNotes(new NoteArray([note]));
  return { builder: withNote, recipe: full };
}

/** The built request of a custom-note proposal, and the recipe with the salt and block it bound. */
export async function buildCustomNoteRequest(
  client: CustomNoteRequestClient,
  recipe: CustomNoteRecipe,
): Promise<{ request: TransactionRequest; recipe: CustomNoteRecipe }> {
  const { builder, recipe: full } = await buildCustomNoteRequestBuilder(client, recipe);
  const request = builder.build();
  return {
    request,
    recipe: {
      ...full,
      saltHex: requestSaltHex(request) ?? full.saltHex,
      boundBlockNum: requestBoundBlockNum(request) ?? full.boundBlockNum,
    },
  };
}

/** What this module needs from `Multisig`, narrowed so a test can stand one in. */
export interface CustomProposalSubmitter {
  createCustomProposal(transactionRequestBytes: Uint8Array, proposalType: string, options: object): Promise<{ id: string }>;
}

export interface BuiltCustomNoteRequest {
  request: { serialize(): Uint8Array };
  recipe: CustomNoteRecipe;
}

/**
 * Submits a built request as a custom proposal labelled with its recipe, and keeps the recipe,
 * with the note id, under the proposal id for this browser's own execute.
 */
export async function createCustomNoteProposalWith(
  ms: CustomProposalSubmitter,
  built: BuiltCustomNoteRequest,
  noteIdHex: string,
): Promise<{ id: string }> {
  const full: CustomNoteRecipe = { ...built.recipe, noteIdHex };
  const proposal = await ms.createCustomProposal(built.request.serialize(), encodeRecipeLabel(full), {});
  saveRecipe(proposal.id, full);
  return proposal;
}
