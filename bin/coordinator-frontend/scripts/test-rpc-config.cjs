const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
const configCode = compile('src/config/psm.ts');
const apiCode = compile('src/lib/multisigApi.ts');
function config(value) {
  const scope = { exports: {}, process: { env: { NEXT_PUBLIC_MIDEN_RPC_URL: value } } };
  vm.runInNewContext(configCode, scope);
  return scope.exports;
}

test('resolves supported RPC shorthand and preserves explicit endpoints', () => {
  for (const [value, expected] of [
    [undefined, 'https://rpc.devnet.miden.io'],
    ['devnet', 'https://rpc.devnet.miden.io'],
    [' DEVNET ', 'https://rpc.devnet.miden.io'],
    ['testnet', 'https://rpc.testnet.miden.io'],
    ['local', 'http://localhost:57291'],
    ['localhost', 'http://localhost:57291'],
    [' https://custom.example:443/rpc ', 'https://custom.example:443/rpc'],
  ]) assert.equal(config(value).MIDEN_RPC_URL, expected);
});

test('Guardian receives the full devnet RPC URL, never the shorthand hostname', async () => {
  let received;
  const scope = { exports: {}, require(name) {
    if (name === '@/config/psm') return config('devnet');
    if (name === '@openzeppelin/miden-multisig-client') return {
      MultisigClient: class {
        constructor(_client, options) { received = options; }
        guardianClient = { getPubkey: async () => ({ commitment: 'commitment' }) };
      },
    };
    return {};
  } };
  vm.runInNewContext(apiCode, scope);
  await scope.exports.initMultisigClient({}, 'https://guardian.example');
  assert.equal(received.midenRpcEndpoint, 'https://rpc.devnet.miden.io');
});
