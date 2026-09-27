const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/lib/midenRpcDiagnostics.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
function runtime(fetch, mode = 'development') {
  const logs = [];
  const scope = { exports: {}, process: { env: { NODE_ENV: mode } },
    console: { log: value => logs.push(value) }, fetch,
    Request, Response, URL, Uint8Array, DataView, TextDecoder, atob, setTimeout, clearTimeout };
  vm.runInNewContext(code, scope);
  return { api: scope.exports, scope, logs };
}
function frame(payload, flag = 0) {
  const result = new Uint8Array(5 + payload.length);
  result[0] = flag;
  new DataView(result.buffer).setUint32(1, payload.length);
  result.set(payload, 5);
  return result;
}
function request(block = 211641) {
  const id = Uint8Array.from({ length: 15 }, (_, i) => i + 1);
  const data = new Uint8Array(block === null ? 19 : 26);
  data.set([10, 17, 10, 15, ...id]);
  if (block !== null) { data.set([18, 5, 13], 19); new DataView(data.buffer).setUint32(22, block, true); }
  return frame(data);
}
const trailers = frame(new TextEncoder().encode('grpc-status: 5\r\ngrpc-message: historical%20state%20missing\r\n'), 128);

test('decodes only account ID, block and details presence; handles block zero and tip', () => {
  const { api } = runtime();
  assert.equal(api.decodeAccountRequest(request()).requestedBlock, 211641);
  assert.equal(api.decodeAccountRequest(request()).serializedAccountIdHex, '0x0102030405060708090a0b0c0d0e0f');
  assert.equal(api.decodeAccountRequest(request(0)).requestedBlock, 0);
  assert.equal(api.decodeAccountRequest(request(null)).atChainTip, true);
  assert.equal(api.decodeGrpcTrailers(trailers).grpcMessage, 'historical state missing');
  assert.throws(() => api.decodeAccountRequest(new Uint8Array([0, 1])));
});

test('fetch observes binary/text gRPC without consuming caller bodies or changing arguments', async () => {
  for (const text of [false, true]) {
    let calls = 0;
    const input = new Request('https://rpc.example/rpc.Api/GetAccount', {
      method: 'POST', body: request(), headers: { authorization: 'SECRET_AUTH', 'content-type': 'application/grpc-web+proto' },
    });
    const response = new Response(text ? Buffer.from(trailers).toString('base64') : trailers,
      { headers: { 'content-type': text ? 'application/grpc-web-text' : 'application/grpc-web+proto' } });
    const { api, scope, logs } = runtime(async received => {
      calls++; assert.equal(received, input);
      assert.deepEqual(new Uint8Array(await received.arrayBuffer()), request());
      return response;
    });
    api.installMidenRpcDiagnostics();
    const installed = scope.fetch;
    api.installMidenRpcDiagnostics();
    assert.equal(scope.fetch, installed);
    assert.equal(await scope.fetch(input), response);
    await response.arrayBuffer();
    for (let i = 0; i < 50 && !logs.some(s => s.includes('rpc.TRAILERS ')); i++) await new Promise(r => setTimeout(r, 5));
    assert.equal(calls, 1);
    assert(logs.some(s => s.includes('"requestedBlock":211641')));
    assert(logs.some(s => s.includes('"grpcStatus":"5"')));
    assert(!logs.join('').includes('SECRET_AUTH'));
  }
});

test('unrelated requests bypass diagnostics; original rejection and store result preserved', async () => {
  const error = new Error('offline');
  const { api, scope, logs } = runtime(async () => { throw error; });
  api.installMidenRpcDiagnostics();
  const initial = logs.length;
  await assert.rejects(scope.fetch('https://guardian.example/state'), e => e === error);
  assert.equal(logs.length, initial);
  await assert.rejects(scope.fetch('https://rpc.example/rpc.Api/GetAccount'), e => e === error);
  assert(logs.some(s => s.includes('rpc.FETCH_FAIL')));
  const result = [{ accountId: 'id', code: 'SECRET_CODE' }];
  assert.equal(await api.traceMidenStore('getForeignAccountCode', ['db', ['id']], async () => result), result);
  assert(!logs.join('').includes('SECRET_CODE'));
});

test('production does not install fetch hook', () => {
  const original = async () => new Response();
  const { api, scope } = runtime(original, 'production');
  api.installMidenRpcDiagnostics();
  assert.equal(scope.fetch, original);
});

test('loader instruments both installed SDK realms; rejects unknown SDK layout', () => {
  const loader = require('./miden-diagnostics-loader.cjs');
  const sdk = path.join(root, 'node_modules/@miden-sdk/miden-sdk/dist/st');
  for (const dir of [sdk, path.join(sdk, 'workers')]) {
    const name = fs.readdirSync(dir).find(n => /^Cargo-.*\.js$/.test(n));
    const input = fs.readFileSync(path.join(dir, name), 'utf8');
    const output = loader(input);
    assert(output.includes('__midenDiagInstall();'));
    assert(output.includes('async function __diagOriginal_getForeignAccountCode'));
    assert(output.includes("__midenDiagLog('store.ERROR'"));
  }
  assert.throws(() => loader('changed SDK'), /missing\/ambiguous/);
});
