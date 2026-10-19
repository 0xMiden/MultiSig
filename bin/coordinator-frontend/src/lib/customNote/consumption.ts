import { Endpoint, NoteId, RpcClient, type NetworkNoteStatusInfo } from '@miden-sdk/miden-sdk';

import { MIDEN_RPC_URL } from '@/config/psm';

/**
 * Whether this client lists the note as consumed. False, never a throw, while the note is not
 * known here yet: a note still propagating looks the same as one not consumed yet.
 */
export async function isNoteConsumed(
  client: { notes: { list(query: { ids: string[] }): Promise<{ isConsumed(): boolean }[]> } },
  noteIdHex: string,
): Promise<boolean> {
  const records = await client.notes.list({ ids: [noteIdHex] });
  return records.some((record) => record.isConsumed());
}

/** The node's network-transaction-builder view of a note aimed at a network account. */
export interface NetworkNoteConsumption {
  state: 'applied' | 'awaiting_consumption' | 'failed';
  /** The node's last execution error for the note, when it has one. */
  detail?: string;
}

export type NetworkNoteStatusReader = Pick<RpcClient, 'getNetworkNoteStatus'>;

let networkRpc: NetworkNoteStatusReader | undefined;
/** One read-only node client for the page's lifetime; `getNetworkNoteStatus` is not on the wrapped client. */
function networkRpcClient(): NetworkNoteStatusReader {
  networkRpc ??= new RpcClient(new Endpoint(MIDEN_RPC_URL));
  return networkRpc;
}

/**
 * Where a network note stands with the node's network-transaction builder, which is the only
 * party that can say WHY a note the multisig sent has not been consumed: `applied` once its
 * nullifier committed, `failed` with the node's reason once discarded, otherwise awaiting, with
 * the last error when an attempt already failed. `'not_found'` when the node has no record of
 * the note yet (still propagating, or not a network note): keep polling.
 */
export async function getNetworkNoteConsumption(
  noteIdHex: string,
  rpc: NetworkNoteStatusReader = networkRpcClient(),
): Promise<NetworkNoteConsumption | 'not_found'> {
  let info: NetworkNoteStatusInfo;
  try {
    info = await rpc.getNetworkNoteStatus(NoteId.fromHex(noteIdHex));
  } catch (err) {
    if (/not\s*found/i.test(err instanceof Error ? err.message : String(err))) return 'not_found';
    throw err;
  }
  const detail = info.lastError ?? undefined;
  switch (info.status) {
    case 'NullifierCommitted':
      return { state: 'applied' };
    case 'Discarded':
      return { state: 'failed', detail: detail ?? 'The network account discarded this note.' };
    default:
      return { state: 'awaiting_consumption', detail };
  }
}
