import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerNodeAccount } from '../../src/lib/nodeRegistration';

const RPC = 'https://rpc.testnet.miden.io';

// Only fetch is stubbed.
const id = '0x108514e7b43d60411774d3c16e20b9';
const genesis = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
const field = (tag: number, data: Buffer) => Buffer.concat([Buffer.from([tag, data.length]), data]);
const status = (version = '0.17.1', hash = genesis) => Buffer.concat([
  field(10, Buffer.from(version)), field(18, field(10, hash)),
]);
function frame(flag: number, data: Buffer) {
  const header = Buffer.alloc(5);
  header[0] = flag;
  header.writeUInt32BE(data.length, 1);
  return Buffer.concat([header, data]);
}
function response(data: Buffer, grpcStatus = '0', message = '') {
  return new Response(Buffer.concat([
    frame(0, data), frame(128, Buffer.from(`grpc-status: ${grpcStatus}\r\ngrpc-message: ${message}\r\n`)),
  ]));
}
function stubFetch(replies: Response[]) {
  const calls: Array<{ url: string } & RequestInit> = [];
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    calls.push({ url, ...options });
    const reply = replies.shift();
    if (!reply) throw new Error('Unexpected request');
    return reply;
  });
  return calls;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('registerNodeAccount', () => {
  it('queries Status first, sends the discovered identity, and encodes the account ID as v1', async () => {
    const calls = stubFetch([response(status()), response(Buffer.alloc(0))]);
    let identity: { genesis: string; service: string } | undefined;
    await registerNodeAccount(RPC, id, 'guardian', (value) => { identity = value; });
    expect(calls[0].url).toBe(`${RPC}/miden.node.v1.NodeService/Status`);
    expect(calls[1].url).toBe(`${RPC}/miden.node.v1.NodeService/RegisterAccount`);
    expect(identity?.genesis).toBe(`0x${genesis.toString('hex')}`);
    expect((calls[1].headers as Record<string, string>).accept)
      .toBe(`application/vnd.miden; version=0.17.1; genesis=${identity?.genesis}`);
    const payload = Buffer.from(calls[1].body as Uint8Array);
    expect(payload.readUInt32BE(1)).toBe(payload.length - 5);
    // Independently specified wire bytes: invitation; AccountId.v1; suffix then prefix.
    expect(payload.subarray(5).toString('hex'))
      .toBe('0a08677561726469616e12180a160a090900b9206ec1d3741712090941603db4e7148510');
    expect(calls[1].credentials).toBe('omit');
    expect(calls[1].redirect).toBe('error');
  });

  it.each([
    ['missing genesis', status('0.17.1', Buffer.alloc(0))],
    ['unsupported protocol', status('0.18.0')],
  ])('fails before registering on %s', async (_label, bytes) => {
    const calls = stubFetch([response(bytes)]);
    await expect(registerNodeAccount(RPC, id, 'guardian', () => {})).rejects.toThrow(/genesis|version/);
    expect(calls).toHaveLength(1);
  });

  it('propagates node registration errors instead of reporting success', async () => {
    stubFetch([response(status()), response(Buffer.alloc(0), '3', 'ALREADY_REGISTERED%3A%20account')]);
    await expect(registerNodeAccount(RPC, id, 'guardian', () => {})).rejects.toThrow(/ALREADY_REGISTERED: account/);
  });

  it.each([
    ['a truncated frame', () => new Response(Uint8Array.of(0, 0))],
    ['a missing gRPC status', () => new Response(frame(0, status()))],
  ])('fails closed on %s', async (_label, reply) => {
    const calls = stubFetch([reply()]);
    await expect(registerNodeAccount(RPC, id, 'guardian', () => {})).rejects.toThrow(/Truncated|missing status/);
    expect(calls).toHaveLength(1);
  });

  it('rejects invalid input before any request', async () => {
    const calls = stubFetch([]);
    await expect(registerNodeAccount(RPC, '0x1234', 'guardian', () => {})).rejects.toThrow(/account ID/);
    await expect(registerNodeAccount(RPC, id, 'x'.repeat(1025), () => {})).rejects.toThrow(/invitation/);
    expect(calls).toHaveLength(0);
  });

  it('registers without an invitation code (testnet): the request carries only the account ID', async () => {
    const calls = stubFetch([response(status()), response(Buffer.alloc(0))]);
    await registerNodeAccount(RPC, id, '', () => {});
    const payload = Buffer.from(calls[1].body as Uint8Array).subarray(5);
    // No field 1 (invitation); field 2 (tag 0x12) is the AccountId, same bytes as above.
    expect(payload.toString('hex')).toBe('12180a160a090900b9206ec1d3741712090941603db4e7148510');
  });

  it('falls back to the pre-0.17 rpc.Api service when the node does not implement NodeService', async () => {
    const calls = stubFetch([
      response(Buffer.alloc(0), '12', 'unimplemented'),
      response(status()),
      response(Buffer.alloc(0)),
    ]);
    let service = '';
    await registerNodeAccount(RPC, id, 'guardian', (identity) => { service = identity.service; });
    expect(calls.map((c) => c.url.replace(RPC, ''))).toEqual([
      '/miden.node.v1.NodeService/Status',
      '/rpc.Api/Status',
      '/rpc.Api/RegisterAccount',
    ]);
    expect(service).toBe('rpc.Api');
  });

  it('propagates HTTP failures without attempting registration', async () => {
    const calls = stubFetch([new Response('', { status: 503 })]);
    await expect(registerNodeAccount(RPC, id, 'guardian', () => {})).rejects.toThrow(/Status HTTP 503/);
    expect(calls).toHaveLength(1);
  });
});
