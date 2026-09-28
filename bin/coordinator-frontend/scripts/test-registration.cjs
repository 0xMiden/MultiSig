const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/multisigApi.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
function setup({ network = 'devnet', allowed = true, rpcError, sdkError } = {}) {
  const calls = { rpc: 0, sdk: 0, allowed: 0 };
  const client = { accounts: {
    isAllowed: async () => { calls.allowed++; return allowed; },
    register: async () => { calls.sdk++; if (sdkError) throw sdkError; },
  } };
  const sdk = {
    Endpoint: { devnet: () => ({}) },
    AccountId: { fromHex: () => ({ free() {} }) },
    RpcClient: class {
      async registerAccount() { calls.rpc++; if (rpcError) throw rpcError; }
      free() {}
    },
  };
  const scope = { exports: {}, require(name) {
    if (name === '@miden-sdk/miden-sdk') return sdk;
    if (name === '@/config/psm') return { MIDEN_RPC_URL: network, MIDEN_REGISTRATION_CODE: 'guardian' };
    if (name === './midenDiagnostics') return { diagnosticLog() {}, diagnosticError: String };
    if (name === './devnetRegistration') return { registerDevnetAccount: async () => {
      calls.rpc++;
      if (rpcError) throw rpcError;
    } };
    return {};
  } };
  vm.runInNewContext(code, scope);
  return { run: () => scope.exports.registerAccountOnNode(client, '0x1234'), calls };
}

test('devnet sends funding RPC even when all accounts are allowed, and deduplicates concurrent calls', async () => {
  const { run, calls } = setup();
  const first = run();
  assert.equal(run(), first);
  await first;
  assert.deepEqual(calls, { rpc: 1, sdk: 0, allowed: 0 });
});

test('duplicate RPC registration is accepted only after checking the account is allowed', async () => {
  for (const message of ['ALREADY_REGISTERED', 'account is already registered']) {
    const { run, calls } = setup({ rpcError: new Error(message) });
    await run();
    assert.equal(calls.allowed, 1);
    const rejected = setup({ rpcError: new Error(message), allowed: false });
    await assert.rejects(rejected.run(), /registered/i);
  }
});

test('real RPC errors propagate; failed requests can be retried', async () => {
  const error = new Error('INVITATION_NOT_FOUND');
  const { run, calls } = setup({ rpcError: error });
  await assert.rejects(run(), e => e === error);
  await assert.rejects(run(), e => e === error);
  assert.equal(calls.rpc, 2);
});

test('non-devnet does not bypass SDK registration checks', async () => {
  const allowed = setup({ network: 'testnet' });
  await allowed.run();
  assert.equal(allowed.calls.rpc + allowed.calls.sdk, 0);
  const gated = setup({ network: 'testnet', allowed: false });
  await gated.run();
  assert.equal(gated.calls.sdk, 1);
  assert.equal(gated.calls.rpc, 0);
});
