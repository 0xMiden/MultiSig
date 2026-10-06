import {
  AccountId,
  AccountStorageRequirements,
  ForeignAccount,
  ForeignAccountArray,
  Note,
  NoteArray,
  Word,
  type MidenClient,
  type TransactionRequest,
  type TransactionRequestBuilder,
} from '@miden-sdk/miden-sdk';
import { requestBoundBlockNum, requestSaltHex } from '@openzeppelin/miden-multisig-client';

import { buildAdminNoteBytes, initAdminWasm } from './noteBuilders';
import { encodeRecipeLabel, saveRecipe, type AdminRecipe } from './recipe';

// Goldilocks field modulus (2^64 - 2^32 + 1). `Word`'s constructor requires each of its four
// u64 limbs to be a *canonical* field element, strictly less than this — see
// `node_modules/@miden-sdk/miden-sdk/dist/st/crates/miden_client_web.d.ts` (class Word,
// `constructor(u64_vec: BigUint64Array)`). A limb drawn uniformly from the full u64 range lands
// at or beyond the modulus with probability ~2^-32; reducing mod P below makes that impossible
// rather than merely astronomically unlikely.
const FIELD_P = 0xffffffff00000001n;

/**
 * Draws a fresh, uniformly random `Word` suitable for use as a multisig fee-conversion salt.
 * Each of the four limbs is reduced mod the field modulus before being handed to `Word`'s
 * constructor, so construction can never fail no matter what `crypto.getRandomValues` returns.
 */
function freshSaltWord(): Word {
  const limbs = new BigUint64Array(4);
  crypto.getRandomValues(limbs);
  for (let i = 0; i < limbs.length; i++) {
    limbs[i] = limbs[i] % FIELD_P;
  }
  return new Word(limbs);
}

/**
 * Builds (but does not `.build()`) the `TransactionRequestBuilder` for an admin proposal: a
 * multisig-auth-aware builder (via `MidenClient.feeAwareTransactionRequestBuilder`, the only
 * *public* surface for this — see R-pre4 in the task-8 brief, which rules out the deep,
 * non-exported `@openzeppelin/miden-multisig-client/dist/transaction/authArgs` subpath) carrying
 * the admin note as its own output note.
 *
 * Exposed as its own function (not inlined into `buildAdminTransactionRequest`) so a later task
 * can fold in additional advice-map entries before calling `.build()` itself.
 *
 * Does *not* call `.withAuthArg()` or `.withFeeConversionSalt()` on the returned builder — either
 * would wipe the multisig auth args that `feeAwareTransactionRequestBuilder` already attached.
 */
export async function buildAdminTransactionRequestBuilder(
  client: MidenClient,
  recipe: AdminRecipe,
): Promise<{ builder: TransactionRequestBuilder; recipe: AdminRecipe }> {
  await initAdminWasm();

  // Sync to the tip so the fee FPI's foreign-account load references a block where the faucet
  // exists (a stale sync height produced the transient `before_foreign_load` failures).
  try {
    await client.sync();
  } catch {
    // A transient sync failure shouldn't block building; the builder below surfaces real errors.
  }

  const saltWord = recipe.saltHex ? Word.fromHex(recipe.saltHex) : freshSaltWord();
  // Capture the hex before the salt is passed to `feeAwareTransactionRequestBuilder`: per
  // `MultisigAuthOptions.feeConversionSalt`'s doc, the `Word` is moved across the WASM boundary
  // and a second read off the same handle is not reliable afterward.
  const saltHex = saltWord.toHex();

  const builder = await client.feeAwareTransactionRequestBuilder(recipe.senderAccountId, {
    feeConversionSalt: saltWord,
    boundBlockNum: recipe.boundBlockNum || undefined,
  });

  const full: AdminRecipe = { ...recipe, saltHex };
  // The note's serial derives from `saltHex` (see `deriveAdminSerial` in `./recipe`), so the note
  // must be built from `full`, not the original `recipe`, once the salt is finalized.
  const note = Note.deserialize(buildAdminNoteBytes(full));

  // The admin note's fee is estimated by FPI'ing the faucet's `estimate_note_fee` procedure. The
  // web `MidenClient` — unlike the Rust client — does NOT lazily fetch the foreign account that FPI
  // targets, so we must provide the faucet explicitly as a public foreign account or the executor
  // fails with `before_foreign_load` ("account not found"). Empty `AccountStorageRequirements` is
  // the default (no specific storage slots required) — the executor loads the whole account.
  const faucetForeign = ForeignAccount.public(
    AccountId.fromHex(full.faucetId),
    new AccountStorageRequirements(),
  );
  const withNote = builder
    .withForeignAccounts(new ForeignAccountArray([faucetForeign]))
    .withOwnOutputNotes(new NoteArray([note]));

  return { builder: withNote, recipe: full };
}

/**
 * Builds the complete admin `TransactionRequest` for `recipe`. Mirrors the P2ID creation path
 * (`handleCreateP2idProposal` / `buildP2idTransactionRequest`), but for a USDCx admin note.
 *
 * Needs a live `MidenClient`/account to build against — not unit-tested here (covered by the
 * Task 14 e2e suite). `createAdminProposalWith` below, which this feeds into, *is* unit-tested.
 */
export async function buildAdminTransactionRequest(
  client: MidenClient,
  recipe: AdminRecipe,
): Promise<{ request: TransactionRequest; recipe: AdminRecipe }> {
  const { builder, recipe: full } = await buildAdminTransactionRequestBuilder(client, recipe);
  const request = builder.build();

  const boundBlockNum = requestBoundBlockNum(request) ?? full.boundBlockNum;
  const saltHex = requestSaltHex(request) ?? full.saltHex;

  return { request, recipe: { ...full, saltHex, boundBlockNum } };
}

/** The minimal shape of `Multisig` this module needs — kept narrow so tests can mock it. */
export interface CustomProposalSubmitter {
  createCustomProposal(
    transactionRequestBytes: Uint8Array,
    proposalType: string,
    options: object,
  ): Promise<{ id: string }>;
}

/** The minimal shape of a built admin transaction request this module needs. */
export interface BuiltAdminTransactionRequest {
  request: { serialize(): Uint8Array };
  recipe: AdminRecipe;
}

/**
 * Submits an already-built admin transaction request as a custom proposal and persists the
 * recipe locally, keyed by the resulting proposal id.
 *
 * Factored out of `handleCreateAdminProposal` as a dependency-injected seam: `ms` and `built` are
 * both narrow, easily-mocked shapes, so this is unit-testable without a live `MidenClient` or
 * `Multisig` — unlike `buildAdminTransactionRequest`, which needs both.
 */
export async function createAdminProposalWith(
  ms: CustomProposalSubmitter,
  built: BuiltAdminTransactionRequest,
  noteIdHex: string,
): Promise<{ id: string }> {
  const full: AdminRecipe = { ...built.recipe, noteIdHex };
  const proposal = await ms.createCustomProposal(
    built.request.serialize(),
    encodeRecipeLabel(full),
    {},
  );
  saveRecipe(proposal.id, full);
  return proposal;
}
