// Imported into each WASM glue realm by the development-only webpack loader.
// Observes existing calls only; does not sync, retry, or make additional RPCs.
const realm = typeof window === 'undefined' ? 'worker' : 'window';
const session = `${realm}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
let counter = 0;

export function rpcDiagnosticLog(event: string, data: unknown): void {
  try {
    console.log(`[MIDEN-DIAG] ${event} ${JSON.stringify({ time: new Date().toISOString(), realm: session, data })}`);
  } catch { /* Never break the observed operation. */ }
}

export async function traceMidenStore<T>(method: string, args: unknown[], call: () => Promise<T>): Promise<T> {
  const lookup = `${session}-store-${++counter}`;
  // Never dump state payloads: they can contain account seeds, code, and notes.
  const state = args[1] as Record<string, unknown> | undefined;
  const write = method.startsWith('apply');
  const context = { lookup, method, database: args[0],
    accountIds: method === 'applyFullAccountState' ? state?.accountId
      : method === 'applyTransactionBatch' ? undefined : args[1],
    nonce: method === 'applyFullAccountState' ? state?.nonce : method === 'applyAccountPatch' ? args[2] : undefined,
    commitment: method === 'applyFullAccountState' ? state?.accountCommitment
      : method === 'applyAccountPatch' ? args[11] : undefined,
    batch: method === 'applyTransactionBatch' && Array.isArray(args[1]) ? args[1].map(payload => ({
      transactionId: payload.transactionRecord?.id,
      accountId: payload.accountState?.accountId ?? payload.accountState?.account?.accountId,
      nonce: payload.accountState?.nonce ?? payload.accountState?.account?.nonce,
      kind: payload.accountState?.kind,
    })) : undefined,
    activeWrites: [...activeStoreWrites],
  };
  const started = Date.now();
  if (write) activeStoreWrites.add(lookup);
  rpcDiagnosticLog('store.START', context);
  try {
    const result = await call();
    rpcDiagnosticLog('store.RESULT', { ...context, found: result != null,
      ms: Date.now() - started,
      header: method === 'getAccountHeader' || method === 'getAccountHeaderByCommitment'
        ? headerMetadata(result) : undefined,
      count: Array.isArray(result) ? result.length : undefined });
    return result;
  } catch (error) {
    rpcDiagnosticLog('store.FAIL', { ...context, ms: Date.now() - started, message: String(error) });
    throw error;
  } finally {
    activeStoreWrites.delete(lookup);
  }
}

const activeStoreWrites = new Set<string>();
function headerMetadata(value: unknown) {
  const header = value as Record<string, unknown> | null;
  if (!header) return null;
  return { id: header.id, nonce: header.nonce, codeRoot: header.codeRoot,
    storageRoot: header.storageRoot, vaultRoot: header.vaultRoot,
    locked: header.locked, watched: header.watched };
}

// Minimal protobuf reader for the AccountRequest envelope. Other fields
// (storage keys, account code, vault assets) are skipped and never logged.
function fields(bytes: Uint8Array): Map<number, Uint8Array | number> {
  let offset = 0;
  const out = new Map<number, Uint8Array | number>();
  const varint = () => {
    let value = 0;
    for (let shift = 0; shift <= 49; shift += 7) {
      if (offset >= bytes.length) throw new Error('truncated protobuf varint');
      const b = bytes[offset++];
      value += (b & 127) * 2 ** shift;
      if (!(b & 128)) return value;
    }
    throw new Error('oversized protobuf varint');
  };
  while (offset < bytes.length) {
    const tag = varint();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (!field) throw new Error('invalid protobuf tag');
    if (wire === 0) { out.set(field, varint()); continue; }
    const length = wire === 2 ? varint() : wire === 5 ? 4 : wire === 1 ? 8 : -1;
    if (length < 0 || offset + length > bytes.length) throw new Error('unsupported/truncated protobuf field');
    if (wire === 5) out.set(field, new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true));
    else out.set(field, bytes.slice(offset, offset + length));
    offset += length;
  }
  return out;
}

function frames(bytes: Uint8Array): Array<{ flag: number; payload: Uint8Array }> {
  const result = [];
  for (let offset = 0; offset < bytes.length;) {
    if (offset + 5 > bytes.length) throw new Error('truncated gRPC-web frame');
    const flag = bytes[offset];
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 1, 4).getUint32(0);
    offset += 5;
    if (size > bytes.length - offset) throw new Error('truncated gRPC-web payload');
    result.push({ flag, payload: bytes.subarray(offset, offset + size) });
    offset += size;
  }
  return result;
}

export function decodeAccountRequest(bytes: Uint8Array) {
  const frame = frames(bytes).find((item) => item.flag === 0);
  if (!frame) throw new Error('no uncompressed request frame');
  const request = fields(frame.payload);
  const idEnvelope = request.get(1);
  const id = idEnvelope instanceof Uint8Array ? fields(idEnvelope).get(1) : undefined;
  let accountIdHex: string | null = null;
  // 0.17 AccountId.v1 contains suffix/prefix Felt messages with fixed64 values.
  // Keep the legacy serialized ID separate; never interpret protobuf bytes as an ID.
  if (id instanceof Uint8Array) {
    try {
      const v1 = fields(id);
      const felt = (field: number) => {
        const envelope = v1.get(field);
        const value = envelope instanceof Uint8Array ? fields(envelope).get(1) : undefined;
        if (!(value instanceof Uint8Array) || value.length !== 8) throw new Error('not v1');
        return new DataView(value.buffer, value.byteOffset, 8).getBigUint64(0, true).toString(16).padStart(16, '0');
      };
      accountIdHex = `0x${felt(2)}${felt(1).slice(0, 14)}`;
    } catch { /* Legacy encoding or unavailable; retain only explicitly labelled wire bytes. */ }
  }
  const blockEnvelope = request.get(2);
  const block = blockEnvelope instanceof Uint8Array ? fields(blockEnvelope).get(1) ?? 0 : null;
  return {
    // Wire encoding explicitly labelled; store logs also contain SDK account IDs.
    accountIdHex,
    serializedAccountIdHex: accountIdHex === null && id instanceof Uint8Array ? `0x${Array.from(id, b => b.toString(16).padStart(2, '0')).join('')}` : null,
    requestedBlock: block,
    atChainTip: blockEnvelope === undefined,
    detailsRequested: request.has(3),
  };
}

function grpcMessage(value: string | null): string | null {
  if (value == null) return null;
  try { return decodeURIComponent(value).slice(0, 4096); } catch { return value.slice(0, 4096); }
}

export function decodeGrpcTrailers(bytes: Uint8Array) {
  const result: { grpcStatus?: string; grpcMessage?: string | null } = {};
  for (const frame of frames(bytes)) {
    if (!(frame.flag & 128)) continue;
    for (const line of new TextDecoder().decode(frame.payload).split('\r\n')) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const key = line.slice(0, colon).toLowerCase();
      const value = line.slice(colon + 1).trim();
      if (key === 'grpc-status') result.grpcStatus = value;
      if (key === 'grpc-message') result.grpcMessage = grpcMessage(value);
    }
  }
  return result;
}

async function readCopy(message: Request | Response, limit: number): Promise<Uint8Array> {
  const reader = message.body?.getReader();
  if (!reader) return new Uint8Array();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 10000);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (timedOut) throw new Error('diagnostic body read timed out');
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error('diagnostic body size limit exceeded');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (message.headers.get('content-type')?.includes('grpc-web-text')) {
      return Uint8Array.from(atob(new TextDecoder().decode(bytes)), c => c.charCodeAt(0));
    }
    return bytes;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

export function installMidenRpcDiagnostics(): void {
  if (process.env.NODE_ENV !== 'development' || typeof globalThis.fetch !== 'function') return;
  const marker = Symbol.for('miden.getAccountDiagnostics.v1');
  const scope = globalThis as typeof globalThis & { [marker]?: boolean };
  if (scope[marker]) return;
  scope[marker] = true;
  const original = globalThis.fetch;
  globalThis.fetch = async function (input, init) {
    let endpoint: string | undefined;
    try {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (/\/GetAccount$/.test(url.pathname)) endpoint = `${url.origin}${url.pathname}`;
    } catch { /* Unrelated or non-absolute fetch. */ }
    if (!endpoint) return original.call(this, input, init);
    const rpc = `${session}-rpc-${++counter}`;
    const started = Date.now();
    const context = { rpc, endpoint };
    rpcDiagnosticLog('rpc.START', context);
    try {
      const requestCopy = new Request(input instanceof Request ? input.clone() : input, init);
      void readCopy(requestCopy, 65536).then(bytes => {
        rpcDiagnosticLog('rpc.REQUEST', { ...context, ...decodeAccountRequest(bytes) });
      }).catch(error => rpcDiagnosticLog('rpc.REQUEST_UNAVAILABLE', { ...context, message: String(error) }));
    } catch (error) { rpcDiagnosticLog('rpc.REQUEST_UNAVAILABLE', { ...context, message: String(error) }); }
    try {
      const response = await original.call(this, input, init);
      rpcDiagnosticLog('rpc.HEADERS', { ...context, ms: Date.now() - started, httpStatus: response.status,
        grpcStatus: response.headers.get('grpc-status'), grpcMessage: grpcMessage(response.headers.get('grpc-message')) });
      try {
        void readCopy(response.clone(), 2 * 1024 * 1024).then(bytes => {
          const trailers = decodeGrpcTrailers(bytes);
          rpcDiagnosticLog('rpc.TRAILERS', { ...context, ms: Date.now() - started,
            ...trailers, trailersVisible: trailers.grpcStatus !== undefined });
        }).catch(error => rpcDiagnosticLog('rpc.TRAILERS_UNAVAILABLE', { ...context, message: String(error) }));
      } catch (error) { rpcDiagnosticLog('rpc.TRAILERS_UNAVAILABLE', { ...context, message: String(error) }); }
      return response;
    } catch (error) {
      rpcDiagnosticLog('rpc.FETCH_FAIL', { ...context, ms: Date.now() - started, message: String(error) });
      throw error;
    }
  };
  rpcDiagnosticLog('rpc.INSTALLED', { coverage: 'GetAccount fetch and local account/code lookups in this realm' });
}
