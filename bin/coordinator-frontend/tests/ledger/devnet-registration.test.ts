import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerDevnetAccount } from '../../src/lib/devnetRegistration';

// Only fetch is stubbed.
const id = '0x108514e7b43d60411774d3c16e20b9';
const genesis = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
const field = (tag: number, data: Buffer) => Buffer.concat([Buffer.from([tag, data.length]), data]);
const status = (version = '0.17.0-rc.2', hash = genesis) => Buffer.concat([
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

describe('registerDevnetAccount', () => {
  it('queries Status first, sends the discovered identity, and encodes the account ID as v1', async () => {
    const calls = stubFetch([response(status()), response(Buffer.alloc(0))]);
    let identity: { genesis: string } | undefined;
    await registerDevnetAccount(id, 'guardian', (value) => { identity = value as { genesis: string }; });
    expect(calls[0].url).toBe('https://rpc.devnet.miden.io/rpc.Api/Status');
    expect(calls[1].url).toBe('https://rpc.devnet.miden.io/rpc.Api/RegisterAccount');
    expect(identity?.genesis).toBe(`0x${genesis.toString('hex')}`);
    expect((calls[1].headers as Record<string, string>).accept)
      .toBe(`application/vnd.miden; version=0.17.0-rc.2; genesis=${identity?.genesis}`);
    const payload = Buffer.from(calls[1].body as Uint8Array);
    expect(payload.readUInt32BE(1)).toBe(payload.length - 5);
    // Independently specified wire bytes: invitation; AccountId.v1; suffix then prefix.
    expect(payload.subarray(5).toString('hex'))
      .toBe('0a08677561726469616e12180a160a090900b9206ec1d3741712090941603db4e7148510');
    expect(calls[1].credentials).toBe('omit');
    expect(calls[1].redirect).toBe('error');
  });

  it.each([
    ['missing genesis', status('0.17.0-rc.2', Buffer.alloc(0))],
    ['unsupported protocol', status('0.18.0')],
  ])('fails before registering on %s', async (_label, bytes) => {
    const calls = stubFetch([response(bytes)]);
    await expect(registerDevnetAccount(id, 'guardian', () => {})).rejects.toThrow(/genesis|version/);
    expect(calls).toHaveLength(1);
  });

  it('propagates node registration errors instead of reporting success', async () => {
    stubFetch([response(status()), response(Buffer.alloc(0), '3', 'ALREADY_REGISTERED%3A%20account')]);
    await expect(registerDevnetAccount(id, 'guardian', () => {})).rejects.toThrow(/ALREADY_REGISTERED: account/);
  });

  it.each([
    ['a truncated frame', () => new Response(Uint8Array.of(0, 0))],
    ['a missing gRPC status', () => new Response(frame(0, status()))],
  ])('fails closed on %s', async (_label, reply) => {
    const calls = stubFetch([reply()]);
    await expect(registerDevnetAccount(id, 'guardian', () => {})).rejects.toThrow(/Truncated|missing status/);
    expect(calls).toHaveLength(1);
  });

  it('rejects invalid input before any request', async () => {
    const calls = stubFetch([]);
    await expect(registerDevnetAccount('0x1234', 'guardian', () => {})).rejects.toThrow(/account ID/);
    await expect(registerDevnetAccount(id, '', () => {})).rejects.toThrow(/invitation/);
    expect(calls).toHaveLength(0);
  });

  it('propagates HTTP failures without attempting registration', async () => {
    const calls = stubFetch([new Response('', { status: 503 })]);
    await expect(registerDevnetAccount(id, 'guardian', () => {})).rejects.toThrow(/Status HTTP 503/);
    expect(calls).toHaveLength(1);
  });
});
