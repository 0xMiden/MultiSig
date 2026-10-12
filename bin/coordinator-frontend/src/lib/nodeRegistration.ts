// Registers an account with a Miden node over gRPC-web. The SDK's standalone
// RpcClient cannot do this: the node gates RegisterAccount on an accept header
// carrying its version and genesis commitment, which the standalone client does
// not set ("accept header validation failed"). So: read both from Status, then
// call RegisterAccount with them. Mirrors Guardian's register-account script.
//
// 0.17 nodes serve the RPC as miden.node.v1.NodeService (the version check
// below rejects any other generation anyway).
import { FUNDING_WAIT_MS } from './fundingWait';

const SERVICE = 'miden.node.v1.NodeService';
const REGISTER_TIMEOUT_MS = FUNDING_WAIT_MS;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function varint(value: number): Uint8Array {
  const bytes = [];
  do { bytes.push((value & 127) | (value > 127 ? 128 : 0)); value = Math.floor(value / 128); } while (value);
  return Uint8Array.from(bytes);
}

function field(number: number, bytes: Uint8Array): Uint8Array {
  return concat(varint(number * 8 + 2), varint(bytes.length), bytes);
}

// Only length-delimited fields are returned; other protobuf wire types are skipped.
function fields(bytes: Uint8Array): Map<number, Uint8Array> {
  let offset = 0;
  const read = () => {
    let value = 0;
    for (let shift = 0; shift < 49; shift += 7) {
      if (offset >= bytes.length) throw new Error('Truncated node Status response');
      const byte = bytes[offset++];
      value += (byte & 127) * 2 ** shift;
      if (!(byte & 128)) return value;
    }
    throw new Error('Invalid node Status varint');
  };
  const result = new Map<number, Uint8Array>();
  while (offset < bytes.length) {
    const tag = read();
    if (tag < 8) throw new Error('Invalid node Status field');
    const wire = tag % 8;
    if (wire === 0) { read(); continue; }
    const length = wire === 2 ? read() : wire === 1 ? 8 : wire === 5 ? 4 : -1;
    if (length < 0 || length > bytes.length - offset) throw new Error('Malformed node Status response');
    if (wire === 2) result.set(Math.floor(tag / 8), bytes.slice(offset, offset + length));
    offset += length;
  }
  return result;
}

async function call(
  rpcUrl: string,
  method: 'Status' | 'RegisterAccount',
  payload: Uint8Array,
  accept?: string,
): Promise<Uint8Array> {
  const frame = new Uint8Array(5 + payload.length);
  new DataView(frame.buffer).setUint32(1, payload.length);
  frame.set(payload, 5);
  const response = await fetch(`${rpcUrl.replace(/\/+$/, '')}/${SERVICE}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/grpc-web+proto', 'x-grpc-web': '1', ...(accept ? { accept } : {}) },
    body: frame,
    // A node with a funding service answers RegisterAccount only once the
    // funding note is committed, which can take minutes; registration runs in
    // the background, so give it as long as the funding wait.
    signal: AbortSignal.timeout(method === 'Status' ? 30_000 : REGISTER_TIMEOUT_MS),
    credentials: 'omit',
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  let status = response.headers.get('grpc-status');
  let message = response.headers.get('grpc-message') ?? '';
  let data: Uint8Array | undefined;
  const bytes = new Uint8Array(await response.arrayBuffer());
  for (let offset = 0; offset < bytes.length;) {
    if (bytes.length - offset < 5) throw new Error(`Truncated ${method} response frame`);
    const flag = bytes[offset];
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 1, 4).getUint32(0);
    offset += 5;
    if (size > bytes.length - offset) throw new Error(`Truncated ${method} response payload`);
    const part = bytes.slice(offset, offset + size);
    offset += size;
    if (flag === 128) {
      const trailers = new Headers();
      for (const line of decoder.decode(part).split('\r\n')) {
        const colon = line.indexOf(':');
        if (colon > 0) trailers.set(line.slice(0, colon), line.slice(colon + 1).trim());
      }
      status = trailers.get('grpc-status') ?? status;
      message = trailers.get('grpc-message') ?? message;
    } else if (flag === 0 && data === undefined) data = part;
    else throw new Error(`Unsupported ${method} response frame`);
  }
  if (status !== '0') {
    try { message = decodeURIComponent(message); } catch { /* Keep the original message. */ }
    throw new Error(`${method} RPC failed (${status ?? 'missing status'}): ${message}`);
  }
  if (data === undefined) throw new Error(`Missing ${method} response message`);
  return data;
}

export interface NodeIdentity { version: string; genesis: string }

/** The node's version and genesis commitment, from its Status. */
export async function readNodeIdentity(rpcUrl: string): Promise<NodeIdentity> {
  const status = fields(await call(rpcUrl, 'Status', new Uint8Array()));
  const version = decoder.decode(status.get(1));
  const genesis = fields(status.get(2) ?? new Uint8Array()).get(1);
  // Do not silently claim compatibility with a different protocol generation.
  if (!/^0\.17\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Unsupported node version: ${version || 'missing'}`);
  }
  if (genesis?.length !== 32) throw new Error('Node Status is missing a valid genesis commitment');
  return { version, genesis: `0x${Array.from(genesis, b => b.toString(16).padStart(2, '0')).join('')}` };
}

export async function registerNodeAccount(
  rpcUrl: string,
  accountId: string,
  invitationCode: string,
  onIdentity: (identity: NodeIdentity) => void,
): Promise<void> {
  if (!/^0x[0-9a-f]{30}$/i.test(accountId)) throw new Error('Expected a 15-byte Miden account ID');
  if (invitationCode.length > 1024) throw new Error('Invalid registration invitation code');
  // AccountId.v1: suffix = field 1, prefix = field 2; Felt.value is fixed64 LE.
  const felt = (hex: string) => {
    const bytes = new Uint8Array(9);
    bytes[0] = 9;
    new DataView(bytes.buffer).setBigUint64(1, BigInt(`0x${hex}`), true);
    return bytes;
  };
  const id = field(1, concat(field(1, felt(`${accountId.slice(18)}00`)), field(2, felt(accountId.slice(2, 18)))));
  const identity = await readNodeIdentity(rpcUrl);
  onIdentity(identity);
  // An empty code is sent without field 1 (the app always passes one on
  // testnet, "00000" by default; see defaultInvitationCode).
  const invitation = invitationCode ? field(1, encoder.encode(invitationCode)) : new Uint8Array();
  await call(rpcUrl, 'RegisterAccount', concat(invitation, field(2, id)),
    `application/vnd.miden; version=${identity.version}; genesis=${identity.genesis}`);
}
