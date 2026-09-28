// Development-only instrumentation of both main-thread and worker WASM glue.
// No files in node_modules are modified. Fail visibly if the SDK hooks change.
module.exports = function (source) {
  const runtime = require('node:path').resolve(__dirname, '../src/lib/midenRpcDiagnostics.ts');
  const hooks = [
    ['getAccountHeader', 'dbId, accountId'],
    ['getForeignAccountCode', 'dbId, accountIds'],
    ['getAccountHeaderByCommitment', 'dbId, accountCommitment'],
    ['getAccountCode', 'dbId, codeRoot'],
    ['getAccountStorage', 'dbId, accountId, slotNames'],
    ['getAccountStorageMaps', 'dbId, accountId'],
    ['getAccountVaultAssets', 'dbId, accountId, vaultKeys'],
    ['applyFullAccountState', 'dbId, accountState'],
    ['applyTransactionBatch', 'dbId, payloads'],
    ['applyAccountPatch', 'dbId, accountId, nonce, updatedSlots, changedMapEntries, changedAssets, codeRoot, storageRoot, vaultRoot, committed, commitment'],
  ];
  let result = source;
  let wrappers = '';
  for (const [name, args] of hooks) {
    const signature = `async function ${name}(${args}) {`;
    if (result.split(signature).length !== 2) throw new Error(`Miden diagnostics: missing/ambiguous ${name} hook`);
    result = result.replace(signature, `async function __diagOriginal_${name}(${args}) {`);
    wrappers += `\nasync function ${name}(${args}) { return __midenDiagStore(${JSON.stringify(name)}, [${args}], () => __diagOriginal_${name}(${args})); }\n`;
  }
  const errorHook = 'const logWebStoreError = (error, errorContext) => {';
  if (!result.includes(errorHook)) throw new Error('Miden diagnostics: missing store error hook');
  result = result.replace(errorHook, `${errorHook}\n__midenDiagLog('store.ERROR', {context: errorContext, message: String(error)});`);
  return `import { installMidenRpcDiagnostics as __midenDiagInstall, traceMidenStore as __midenDiagStore, rpcDiagnosticLog as __midenDiagLog } from ${JSON.stringify(runtime)};\n__midenDiagInstall();\n${result}\n${wrappers}`;
};
