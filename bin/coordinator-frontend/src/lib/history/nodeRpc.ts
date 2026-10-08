import protobuf from 'protobufjs/light';
import { MIDEN_RPC_URL } from '@/config/psm';
import descriptor from './proto/miden_node.json';
import { accountIdPartsFromHex, type WireTransactionRecord } from './decode';

/**
 * A minimal gRPC-web client for the two node calls the browser SDK does not wrap:
 * `SyncTransactions` (an account's on-chain transaction records) and `Status` (the chain tip).
 *
 * The node speaks binary gRPC-web (`application/grpc-web+proto`) with the gRPC status in the
 * body's trailer frame, and gates clients on the `accept` header's version label (a stable node
 * accepts the stable 0.17 line the SDK pins). Messages are encoded with protobufjs's reflection
 * runtime from `./proto/miden_node.json`, generated from the node's `rpc.proto` -- see
 * `./proto/README.md` for how to regenerate it after a node bump.
 */

const SERVICE = 'miden.node.v1.NodeService';
/** Must stay on the node's major.minor line (and pre-release label, if any). */
const ACCEPT = 'application/vnd.miden; version=0.17.0';

let rootCache: protobuf.Root | undefined;
function root(): protobuf.Root {
  if (!rootCache) rootCache = protobuf.Root.fromJSON(descriptor as protobuf.INamespace);
  return rootCache;
}
function type(name: string): protobuf.Type {
  return root().lookupType(name);
}

/** Splits a gRPC-web body into its message frames, throwing on a non-OK trailer status. */
export function parseGrpcWebFrames(body: Uint8Array): Uint8Array[] {
  const messages: Uint8Array[] = [];
  let off = 0;
  while (off + 5 <= body.length) {
    const flag = body[off];
    const len = new DataView(body.buffer, body.byteOffset + off + 1, 4).getUint32(0);
    const frame = body.subarray(off + 5, off + 5 + len);
    off += 5 + len;
    if (flag & 0x80) {
      const trailer = new TextDecoder().decode(frame);
      const status = /grpc-status:\s*(\d+)/i.exec(trailer);
      if (status && status[1] !== '0') {
        const message = /grpc-message:\s*([^\r\n]*)/i.exec(trailer)?.[1] ?? '';
        throw new Error(`node returned grpc-status ${status[1]}: ${decodeURIComponent(message)}`);
      }
    } else {
      messages.push(frame);
    }
  }
  return messages;
}

async function unary(method: string, requestBytes: Uint8Array): Promise<Uint8Array> {
  const frame = new Uint8Array(5 + requestBytes.length);
  new DataView(frame.buffer).setUint32(1, requestBytes.length);
  frame.set(requestBytes, 5);
  const res = await fetch(`${MIDEN_RPC_URL.replace(/\/$/, '')}/${SERVICE}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/grpc-web+proto', 'x-grpc-web': '1', accept: ACCEPT },
    body: frame,
  });
  if (!res.ok) throw new Error(`node ${method} failed: HTTP ${res.status}`);
  let body = new Uint8Array(await res.arrayBuffer());
  if ((res.headers.get('content-type') ?? '').includes('text')) {
    body = Uint8Array.from(atob(new TextDecoder().decode(body)), (c) => c.charCodeAt(0));
  }
  const messages = parseGrpcWebFrames(body);
  if (messages.length === 0) throw new Error(`node ${method} returned no message`);
  return messages[0];
}

/** The node's current chain tip (block number). */
export async function fetchChainTip(): Promise<number> {
  const Req = type('miden.node.v1.StatusRequest');
  const Res = type('miden.node.v1.StatusResponse');
  const res = Res.decode(await unary('Status', Req.encode(Req.create({})).finish())) as unknown as {
    chainTip?: number;
  };
  return Number(res.chainTip ?? 0);
}

export interface AccountTransactionsPage {
  chainTip: number;
  records: WireTransactionRecord[];
}

/**
 * Every on-chain transaction of `accountIdHex` from `fromBlock` to the chain tip, following the
 * node's pagination (a page covers blocks up to `paginationInfo.blockNum`; the next starts after
 * it). The node rejects a `block_to` beyond its tip, so the tip is read first and reused.
 */
export async function fetchAccountTransactions(accountIdHex: string, fromBlock = 0): Promise<AccountTransactionsPage> {
  const Req = type('miden.node.v1.SyncTransactionsRequest');
  const Res = type('miden.node.v1.SyncTransactionsResponse');
  const { prefix, suffix } = accountIdPartsFromHex(accountIdHex);

  let chainTip = await fetchChainTip();
  const records: WireTransactionRecord[] = [];
  let from = fromBlock;
  for (let guard = 0; guard < 64; guard++) {
    const message = Req.fromObject({
      blockRange: { blockFrom: from, blockTo: chainTip },
      accountIds: [{ v1: { prefix: { value: prefix }, suffix: { value: suffix } } }],
    });
    const page = Res.decode(await unary('SyncTransactions', Req.encode(message).finish())) as unknown as {
      paginationInfo?: { chainTip?: number; blockNum?: number };
      transactions?: WireTransactionRecord[];
    };
    records.push(...(page.transactions ?? []));
    const reached = Number(page.paginationInfo?.blockNum ?? chainTip);
    chainTip = Number(page.paginationInfo?.chainTip ?? chainTip);
    if (reached >= chainTip) break;
    from = reached + 1;
  }
  return { chainTip, records };
}
