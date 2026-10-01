import { Note, type MidenClient } from '@miden-sdk/miden-sdk';
import type { Proposal } from '@openzeppelin/miden-multisig-client';

import { buildAdminNoteBytes } from './noteBuilders';
import type { AdminRecipe } from './recipe';

/**
 * Lifecycle of an admin change, from proposal creation through the point the admin note it
 * carries has actually been consumed (nullified) at the faucet. `executed` only means the
 * multisig transaction landed on-chain -- it says nothing about the note. The frontend must
 * never report a change as `applied` on `executed` alone; that requires a real consumption
 * check (see `isNoteConsumed` / `useAdminNoteConsumption`).
 */
export type ConsumptionState =
  | 'created'
  | 'collecting'
  | 'threshold_reached'
  | 'executed'
  | 'awaiting_consumption'
  | 'applied'
  | 'failed';

/**
 * Derives the proposal-lifecycle portion of a `ConsumptionState` from a multisig `Proposal`.
 * Pure: `status` is the primary signal (`finalized` => `executed`, `ready` => `threshold_reached`),
 * and for `pending` proposals the signature count distinguishes `created` (no signatures yet)
 * from `collecting` (at least one). `requiredSignatures`, when given, only refines the `pending`
 * case (a `pending` proposal whose signature count already meets it reports `threshold_reached`
 * rather than `collecting`) -- it never overrides `status` for `ready`/`finalized`.
 *
 * This never returns `applied` or `awaiting_consumption`: those require an actual note-consumption
 * check, which this function -- taking only the proposal -- has no way to perform. See
 * `useAdminNoteConsumption` for the state machine that adds them.
 */
export function deriveStateFromProposal(
  proposal: Proposal,
  requiredSignatures?: number,
): ConsumptionState {
  if (proposal.status === 'finalized') return 'executed';
  if (proposal.status === 'ready') return 'threshold_reached';

  // proposal.status === 'pending'
  const signatureCount = proposal.signatures.length;
  if (requiredSignatures !== undefined && signatureCount >= requiredSignatures) {
    return 'threshold_reached';
  }
  return signatureCount > 0 ? 'collecting' : 'created';
}

/**
 * Resolves the id of the admin note a recipe's proposal will create (or created), WITHOUT ever
 * reading it off a transaction summary's output-note array. That array's ordering is not
 * meaningful -- `getOutputNotesFromTxSummary` (`src/lib/multisigApi.ts:141`) includes the kernel
 * fee note alongside the admin note, at no guaranteed index -- so picking `[0]` (or any fixed
 * index) risks reporting the fee note's id as the admin note's.
 *
 * The note id is instead derived deterministically from the recipe itself: `noteIdHex` when the
 * proposer already computed and stored it (see `createAdminProposalWith`,
 * `src/lib/admin/adminRequest.ts`), or by rebuilding the same note bytes a co-signer would see
 * (`buildAdminNoteBytes`, which is itself deterministic in the recipe's salt) and reading
 * `Note.id()` off the result. Either path arrives at the same id, since `noteIdHex` is always
 * computed this same way when it is set.
 *
 * Requires the admin WASM module to already be initialized (`initAdminWasm()` /
 * `__setInitializedForTests()`) when `recipe.noteIdHex` is absent, since that path calls
 * `buildAdminNoteBytes`.
 */
export function resolveAdminNoteId(recipe: AdminRecipe): string {
  if (recipe.noteIdHex) return recipe.noteIdHex;
  return Note.deserialize(buildAdminNoteBytes(recipe)).id().toString();
}

/**
 * Checks whether the admin note identified by `noteIdHex` has actually been consumed (nullified)
 * at the faucet, by querying the client's locally-tracked input notes. Returns `false` -- never
 * throws -- when the note is not yet known to this client (nothing has been returned for its id
 * yet): that is indistinguishable from "not consumed yet" from the caller's point of view, and a
 * not-yet-synced note is not a terminal error.
 */
export async function isNoteConsumed(client: MidenClient, noteIdHex: string): Promise<boolean> {
  const records = await client.notes.list({ ids: [noteIdHex] });
  return records.some((record) => record.isConsumed());
}
