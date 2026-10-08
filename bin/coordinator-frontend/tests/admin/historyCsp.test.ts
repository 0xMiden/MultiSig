import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as $protobuf from 'protobufjs/minimal';
import Long from 'long';
import { miden } from '@/lib/history/proto/miden_node';

// The deployed console's CSP has no 'unsafe-eval' (`src/lib/securityHeaders.ts` adds it in dev
// only), so building a function from a string throws, which is what the History page hit:
// "Evaluating a string as JavaScript violates the following Content Security Policy directive".
function cspBlocked(): never {
  throw new EvalError('Evaluating a string as JavaScript violates the Content Security Policy');
}

const fixture = JSON.parse(readFileSync(new URL('../fixtures/syncTransactions.testnet.json', import.meta.url), 'utf8'));
const PREFIX = '10639440170341321537';
const SUFFIX = '9058349907662736640';

describe('history wire codec under the production CSP', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('encodes and decodes the node calls without evaluating strings as code', async () => {
    const { codec } = await import('@/lib/history/nodeRpc');
    const response = miden.node.v1.SyncTransactionsResponse.encode(
      miden.node.v1.SyncTransactionsResponse.fromObject(fixture),
    ).finish();
    vi.stubGlobal('Function', cspBlocked);
    vi.stubGlobal('eval', cspBlocked);

    expect(codec.encodeStatusRequest()).toHaveLength(0);
    const request = codec.encodeSyncTransactionsRequest({
      blockRange: { blockFrom: 0, blockTo: 100 },
      accountIds: [{ v1: { prefix: { value: Long.fromString(PREFIX, true) }, suffix: { value: Long.fromString(SUFFIX, true) } } }],
    });
    expect(request.length).toBeGreaterThan(0);
    expect(codec.decodeSyncTransactionsResponse(response).transactions).toHaveLength(10);
    expect(codec.decodeStatusResponse(miden.node.v1.StatusResponse.encode({ chainTip: 51654 }).finish()).chainTip).toBe(51654);
  });

  it('keeps u64 account id parts exact even where protobufjs cannot find `long` by itself', async () => {
    // A browser bundle cannot satisfy protobufjs's `eval("require")("long")` probe, so without
    // explicit wiring the id parts above 2^53 would round through a double.
    $protobuf.util.Long = null as unknown as typeof $protobuf.util.Long;
    $protobuf.configure();
    vi.resetModules(); // so importing nodeRpc runs its wiring again, after the probe "failed"
    const { codec } = await import('@/lib/history/nodeRpc');
    const request = codec.encodeSyncTransactionsRequest({
      blockRange: { blockFrom: 0, blockTo: 100 },
      accountIds: [{ v1: { prefix: { value: Long.fromString(PREFIX, true) }, suffix: { value: Long.fromString(SUFFIX, true) } } }],
    });
    const decoded = miden.node.v1.SyncTransactionsRequest.decode(request);
    expect(String(decoded.accountIds[0].v1?.prefix?.value)).toBe(PREFIX);
    expect(String(decoded.accountIds[0].v1?.suffix?.value)).toBe(SUFFIX);
  });
});
