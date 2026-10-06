import {
  Endpoint,
  Note,
  NoteId,
  RpcClient,
  type MidenClient,
  type NetworkNoteStatusInfo,
} from '@miden-sdk/miden-sdk';
import type { Proposal } from '@openzeppelin/miden-multisig-client';

import { MIDEN_RPC_URL } from '@/config/psm';
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

/** The node's ntx-builder view of an admin (network) note, mapped onto the lifecycle. */
export interface NetworkNoteConsumption {
  state: 'applied' | 'awaiting_consumption' | 'failed';
  /** The node's last execution error for this note, when it has one -- surfaced to the user. */
  detail?: string;
}

/** True for the node's "no ntx-builder record for this note" response, which is not an error. */
function isNoteNotFound(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /not\s*found/i.test(msg);
}

/**
 * A read-only `RpcClient` pointed at the node, memoized for the page's lifetime.
 *
 * `getNetworkNoteStatus` lives on the WASM `RpcClient`, which the wrapped `MidenClient` does not
 * surface, so we talk to the node directly for it. One shared client (rather than one per poll, of
 * which there is one per executed proposal every few seconds) avoids opening a fresh connection on
 * every tick; it is never freed, which is fine for a long-lived page.
 */
let networkRpc: RpcClient | undefined;
function networkRpcClient(): RpcClient {
  if (!networkRpc) {
    networkRpc = new RpcClient(new Endpoint(MIDEN_RPC_URL));
  }
  return networkRpc;
}

/**
 * Queries the node's network-transaction-builder view of an admin note via `getNetworkNoteStatus`
 * and maps it onto a {@link NetworkNoteConsumption}. Unlike `isNoteConsumed` -- which only sees this
 * client's locally-tracked input notes and so can never explain WHY a note has not applied -- this
 * exposes the ntx-builder's own verdict and its `lastError` (e.g. "new max supply is less than
 * current token supply"), which is the whole point: an admin change that executed on the multisig
 * but is rejected by the faucet when the ntx-builder tries to consume its note otherwise fails
 * silently.
 *
 * Returns `'not_found'` when the node has no ntx-builder record for the note yet -- not yet ingested
 * (still propagating), or not a network note. That is neither an error nor terminal; the caller
 * keeps polling (and may fall back to a local `isNoteConsumed` check).
 *
 * Status mapping (`NetworkNoteStatusInfo.status`):
 * - `NullifierCommitted` -> `applied` (the faucet consumed the note and the consume committed).
 * - `Discarded` -> `failed` (the ntx-builder gave up; `detail` is its last error).
 * - `Pending` / `NullifierInflight` -> `awaiting_consumption`, with `detail` carrying `lastError`
 *   when the node has already attempted and failed at least once -- so a note that keeps failing a
 *   deterministic check (and may be retried indefinitely rather than ever reaching `Discarded`)
 *   still shows the user its reason instead of an endless silent "awaiting".
 */
export async function getNetworkNoteConsumption(
  noteIdHex: string,
): Promise<NetworkNoteConsumption | 'not_found'> {
  let info: NetworkNoteStatusInfo;
  try {
    info = await networkRpcClient().getNetworkNoteStatus(NoteId.fromHex(noteIdHex));
  } catch (err) {
    if (isNoteNotFound(err)) return 'not_found';
    throw err;
  }
  const detail = info.lastError ?? undefined;
  switch (info.status) {
    case 'NullifierCommitted':
      return { state: 'applied' };
    case 'Discarded':
      return { state: 'failed', detail: detail ?? 'The faucet discarded this note.' };
    default:
      // 'Pending' | 'NullifierInflight' (and any future pending-like status).
      return { state: 'awaiting_consumption', detail };
  }
}
