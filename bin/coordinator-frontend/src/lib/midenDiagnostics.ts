// Temporary, development-only diagnostics. No extra sync, RPC, or signing calls.
// Deliberately exclude request bodies, signatures, keys, and serialized notes.
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
  if (process.env.NODE_ENV !== 'development') return;
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

function callDetails(method: string, args: unknown[]): unknown {
  // Only explicitly selected scalar metadata, never a general argument dump.
  if (method === 'executeForSummaryAt' || method === 'newTransactionAt') {
    return { accountId: inspect(args[0], 'toString'), anchorBlock: inspect(args[2], 'blockNum') };
  }
  if (method === 'getAccount') return { accountId: inspect(args[0], 'toString') };
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
  if (process.env.NODE_ENV !== 'development') return;
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
          result: method === 'chainAnchorForRequest' ? { anchorBlock: inspect(result, 'blockNum') }
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
    wrap(transactions, 'executeRequest');
  }
}

export function instrumentMultisig(multisig: object, owner: object): void {
  if (process.env.NODE_ENV !== 'development') return;
  linkDiagnosticClient(multisig, owner, 'multisig');
  wrap(multisig, 'getRawClient', (raw) => {
    if (!raw || typeof raw !== 'object') return;
    linkDiagnosticClient(raw, owner, 'guardian-intentional-raw-client');
    for (const method of ['getAccount', 'getSyncHeight', 'chainAnchorForRequest', 'executeForSummaryAt']) wrap(raw, method);
  });
  for (const method of ['syncState', 'syncProposals', 'createAddSignerProposal',
    'createRemoveSignerProposal', 'createChangeThresholdProposal', 'createConsumeNotesProposal',
    'createP2idProposal', 'createSwitchGuardianProposal', 'signProposal', 'executeProposal',
    'verifyProposalMetadataBinding']) wrap(multisig, method);
}
