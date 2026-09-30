// Opt-in Miden SDK diagnostics: the one debugging aid in the app. Off in every
// build unless NEXT_PUBLIC_MIDEN_DIAGNOSTICS=1; when off, nothing is wrapped and
// nothing is logged, so the SDK runs unmodified. Instance-level wrappers only
// (the SDK's bundle is never rewritten). No extra sync, RPC or signing calls;
// request bodies, signatures, keys and serialized notes are never logged, but
// logs do include account IDs, note IDs and vault balances.
export const DIAGNOSTICS_ENABLED = process.env.NEXT_PUBLIC_MIDEN_DIAGNOSTICS === '1';
import type { MidenClient } from '@miden-sdk/miden-sdk';
import type { Multisig, ConsumableNote } from '@openzeppelin/miden-multisig-client';

export async function logReceiveFunding(client: MidenClient, multisig: Multisig, notes: ConsumableNote[]): Promise<void> {
  if (!DIAGNOSTICS_ENABLED) return;
  try {
    const feeId = await client.feeFaucetId();
    const feeFaucet = feeId.toString().toLowerCase();
    feeId.free();
    const vault = multisig.account.vault().fungibleAssets().map(asset => ({
      faucetId: asset.faucetId().toString().toLowerCase(), amount: asset.amount(),
    }));
    const selectedFeeAmount = notes.flatMap(note => note.assets)
      .filter(asset => asset.faucetId.toLowerCase() === feeFaucet)
      .reduce((sum, asset) => sum + asset.amount, 0n);
    const cachedVaultFeeAmount = vault.filter(asset => asset.faucetId === feeFaucet)
      .reduce((sum, asset) => sum + asset.amount, 0n);
    diagnosticLog('receive.FUNDING', {
      accountId: multisig.accountId, feeFaucet,
      cachedVault: vault, selectedNotes: notes, selectedFeeAmount, cachedVaultFeeAmount,
      combinedFeeAssetAmount: selectedFeeAmount + cachedVaultFeeAmount,
      units: 'raw asset units; token symbol/decimals are not assumed',
      feeSufficiency: 'unknown until transaction fee is calculated; zero existing balance alone is not a failure',
    });
  } catch (error) {
    diagnosticLog('receive.FUNDING_UNAVAILABLE', { error: diagnosticError(error) });
  }
}
const ids = new WeakMap<object, string>();
const parents = new WeakMap<object, object>();
const wrapped = new WeakMap<object, Set<string>>();
let sequence = 0;
const session = Date.now().toString(36);

export function diagnosticId(value: object | null | undefined): string | null {
  if (!value) return null;
  let id = ids.get(value);
  if (!id) { id = `${session}-${++sequence}`; ids.set(value, id); }
  return id;
}

export function diagnosticLog(event: string, data: unknown): void {
  if (!DIAGNOSTICS_ENABLED) return;
  try {
    console.log(`[MIDEN-DIAG] ${event} ${JSON.stringify({
      time: new Date().toISOString(), data,
    }, (_key, value) => typeof value === 'bigint' ? value.toString() : value)}`);
  } catch { /* Diagnostics must never change application behavior. */ }
}

export function diagnosticError(error: unknown, depth = 0): unknown {
  if (depth > 4) return '[cause depth limit]';
  if (!error || typeof error !== 'object') return String(error);
  const result: Record<string, unknown> = {};
  // Error fields are often non-enumerable; do not serialize the whole object.
  for (const key of ['name', 'message', 'stack', 'code', 'status', 'cause', 'source']) {
    try {
      const value = (error as Record<string, unknown>)[key];
      if ((key === 'cause' || key === 'source') && value !== undefined) result[key] = diagnosticError(value, depth + 1);
      else if (typeof value === 'string' || typeof value === 'number') result[key] = value;
    } catch { /* Ignore inaccessible properties. */ }
  }
  return result;
}

export function linkDiagnosticClient(child: object, parent: object, role: string): void {
  parents.set(child, parent);
  diagnosticLog('client.link', { role, child: diagnosticId(child), parent: diagnosticId(parent) });
}

export function diagnosticPair(publicClient: object | null, multisigClient: object | null) {
  const bound = multisigClient ? parents.get(multisigClient) : undefined;
  return { publicClient: diagnosticId(publicClient), multisigClient: diagnosticId(multisigClient),
    boundPublicClient: diagnosticId(bound), matches: bound && publicClient ? bound === publicClient : null };
}

type Dynamic = Record<string, unknown>;
function inspect(value: unknown, method: string): unknown {
  try {
    const fn = (value as Dynamic)?.[method];
    return typeof fn === 'function' ? fn.call(value) : undefined;
  } catch { return '[unavailable]'; }
}

function anchorDetails(anchor: unknown): unknown {
  const header = inspect(anchor, 'blockHeader');
  try {
    return { anchorBlock: inspect(anchor, 'blockNum'), verificationBaseFee: inspect(header, 'verificationBaseFee') };
  } finally {
    inspect(header, 'free');
  }
}

function callDetails(method: string, args: unknown[]): unknown {
  // Only explicitly selected scalar metadata, never a general argument dump.
  if (method === 'executeForSummaryAt' || method === 'newTransactionAt') {
    return { accountId: inspect(args[0], 'toString'), anchorBlock: inspect(args[2], 'blockNum') };
  }
  if (method === 'getAccount') return { accountId: inspect(args[0], 'toString') };
  if (method === 'newAccount') {
    const id = inspect(args[0], 'id');
    const commitment = inspect(args[0], 'to_commitment');
    try { return { accountId: inspect(id, 'toString'), nonce: String(inspect(args[0], 'nonce')),
      commitment: inspect(commitment, 'toHex'), overwrite: args[1] }; }
    finally { inspect(id, 'free'); inspect(commitment, 'free'); }
  }
  if (method === 'executeRequest') {
    const options = args[2] as { anchor?: unknown } | undefined;
    return { accountId: typeof args[0] === 'string' ? args[0] : inspect(args[0], 'toString'),
      anchorBlock: inspect(options?.anchor, 'blockNum') };
  }
  if (method === 'signProposal' || method === 'executeProposal') return { proposalId: args[0] };
  if (method === 'createConsumeNotesProposal') return { noteIds: args[0] };
  if (method === 'verifyProposalMetadataBinding') {
    const p = args[0] as { id?: string; metadata?: { proposalType?: string } };
    return { proposalId: p?.id, proposalType: p?.metadata?.proposalType };
  }
  return {};
}

// Instance-only wrappers preserve `this`, return values, and original errors.
// Private SDK hooks are optional: report unsupported hooks rather than failing.
function wrap(target: object, method: string, after?: (result: unknown) => void): void {
  if (!DIAGNOSTICS_ENABLED) return;
  try {
    const record = target as Dynamic;
    const original = record[method];
    if (typeof original !== 'function') {
      diagnosticLog('hook.unavailable', { client: diagnosticId(target), method });
      return;
    }
    const methods = wrapped.get(target) ?? new Set<string>();
    if (methods.has(method)) return;
    record[method] = async function (this: unknown, ...args: unknown[]) {
      const operation = `${session}-op-${++sequence}`;
      const started = Date.now();
      const context = { operation, client: diagnosticId(target), method, details: callDetails(method, args) };
      diagnosticLog('START', context);
      try {
        const result = await original.apply(this, args);
        try { after?.(result); } catch { /* Observational only. */ }
        diagnosticLog('OK', { ...context, ms: Date.now() - started,
          result: method === 'chainAnchorForRequest' ? anchorDetails(result)
            : method === 'getAccount' ? { found: result != null, nonce: String(inspect(result, 'nonce')) }
            : method === 'getSyncHeight' ? result : undefined });
        return result;
      } catch (error) {
        diagnosticLog('FAIL', { ...context, ms: Date.now() - started, error: diagnosticError(error) });
        throw error;
      }
    };
    methods.add(method);
    wrapped.set(target, methods);
  } catch (error) { diagnosticLog('hook.failed', { method, error: diagnosticError(error) }); }
}

export function instrumentPublicClient(client: object): void {
  diagnosticLog('publicClient.created', { client: diagnosticId(client) });
  wrap(client, 'sync');
  const transactions = (client as Dynamic).transactions;
  if (transactions && typeof transactions === 'object') {
    linkDiagnosticClient(transactions, client, 'public-transactions');
    wrap(transactions, 'executeRequest', (execution) => {
      if (!execution || typeof execution !== 'object') return;
      linkDiagnosticClient(execution, transactions, 'execution');
      wrap(execution, 'prove', (proof) => {
        if (!proof || typeof proof !== 'object') return;
        linkDiagnosticClient(proof, execution, 'proof');
        wrap(proof, 'submit', (submission) => {
          if (!submission || typeof submission !== 'object') return;
          linkDiagnosticClient(submission, proof, 'submitted-transaction');
          wrap(submission, 'apply');
        });
      });
    });
  }
}

export function instrumentMultisig(multisig: object, owner: object): void {
  if (!DIAGNOSTICS_ENABLED) return;
  linkDiagnosticClient(multisig, owner, 'multisig');
  wrap(multisig, 'getRawClient', (raw) => {
    if (!raw || typeof raw !== 'object') return;
    linkDiagnosticClient(raw, owner, 'guardian-intentional-raw-client');
    for (const method of ['getAccount', 'getSyncHeight', 'chainAnchorForRequest', 'executeForSummaryAt', 'newAccount', 'syncState']) wrap(raw, method);
  });
  for (const method of ['syncState', 'syncProposals', 'createAddSignerProposal',
    'createRemoveSignerProposal', 'createChangeThresholdProposal', 'createConsumeNotesProposal',
    'createP2idProposal', 'createSwitchGuardianProposal', 'signProposal', 'executeProposal',
    'verifyProposalMetadataBinding']) wrap(multisig, method);
}
