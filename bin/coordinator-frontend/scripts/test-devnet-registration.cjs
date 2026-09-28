const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/devnetRegistration.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const id = '0x108514e7b43d60411774d3c16e20b9';
const genesis = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
const field = (tag, data) => Buffer.concat([Buffer.from([tag, data.length]), data]);
const status = (version = '0.17.0-rc.2', hash = genesis) => Buffer.concat([
  field(10, Buffer.from(version)), field(18, field(10, hash)),
]);
function frame(flag, data) {
  const header = Buffer.alloc(5);
  header[0] = flag;
  header.writeUInt32BE(data.length, 1);
  return Buffer.concat([header, data]);
}
function response(data, grpcStatus = '0', message = '') {
  return new Response(Buffer.concat([
    frame(0, data), frame(128, Buffer.from(`grpc-status: ${grpcStatus}\r\ngrpc-message: ${message}\r\n`)),
  ]));
}
function setup(replies) {
  const calls = [];
  const scope = { exports: {}, TextEncoder, TextDecoder, Headers, AbortSignal,
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      const reply = replies.shift();
      if (!reply) throw new Error('Unexpected request');
      return reply;
    },
  };
  vm.runInNewContext(code, scope);
  return { api: scope.exports, calls };
}

test('Status precedes registration; header includes discovered identity and account ID uses v1 encoding', async () => {
  const { api, calls } = setup([response(status()), response(Buffer.alloc(0))]);
  let identity;
  await api.registerDevnetAccount(id, 'guardian', value => { identity = value; });
  assert.equal(calls[0].url, 'https://rpc.devnet.miden.io/rpc.Api/Status');
  assert.equal(calls[1].url, 'https://rpc.devnet.miden.io/rpc.Api/RegisterAccount');
  assert.equal(identity.genesis, `0x${genesis.toString('hex')}`);
  assert.equal(calls[1].headers.accept, `application/vnd.miden; version=0.17.0-rc.2; genesis=${identity.genesis}`);
  const payload = Buffer.from(calls[1].body);
  assert.equal(payload.readUInt32BE(1), payload.length - 5);
  // Independently specified wire bytes: invitation; AccountId.v1; suffix then prefix.
  assert.equal(payload.subarray(5).toString('hex'),
    '0a08677561726469616e12180a160a090900b9206ec1d3741712090941603db4e7148510');
  assert.equal(calls[1].credentials, 'omit');
  assert.equal(calls[1].redirect, 'error');
});

test('missing genesis or unsupported protocol fails before registration', async () => {
  for (const bytes of [status('0.17.0-rc.2', Buffer.alloc(0)), status('0.18.0')]) {
    const { api, calls } = setup([response(bytes)]);
    await assert.rejects(api.registerDevnetAccount(id, 'guardian', () => {}), /genesis|version/);
    assert.equal(calls.length, 1);
  }
});

test('node registration errors propagate and are never reported as success', async () => {
  const { api } = setup([response(status()), response(Buffer.alloc(0), '3', 'ALREADY_REGISTERED%3A%20account')]);
  await assert.rejects(api.registerDevnetAccount(id, 'guardian', () => {}), /ALREADY_REGISTERED: account/);
});

test('malformed frames and missing gRPC status fail closed', async () => {
  for (const reply of [new Response(Uint8Array.of(0, 0)), new Response(frame(0, status()))]) {
    const { api, calls } = setup([reply]);
    await assert.rejects(api.registerDevnetAccount(id, 'guardian', () => {}), /Truncated|missing status/);
    assert.equal(calls.length, 1);
  }
});

test('invalid input is rejected before a network request', async () => {
  const { api, calls } = setup([]);
  await assert.rejects(api.registerDevnetAccount('0x1234', 'guardian', () => {}), /account ID/);
  await assert.rejects(api.registerDevnetAccount(id, '', () => {}), /invitation/);
  assert.equal(calls.length, 0);
});

test('HTTP failures propagate without attempting registration', async () => {
  const { api, calls } = setup([new Response('', { status: 503 })]);
  await assert.rejects(api.registerDevnetAccount(id, 'guardian', () => {}), /Status HTTP 503/);
  assert.equal(calls.length, 1);
});
