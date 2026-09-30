import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AccountId, TransactionProver, TransactionRequest } from '@miden-sdk/miden-sdk';
import { configureProverWorkflow } from '../../src/lib/proverFallback';
// The SDK's own class, imported by path: its package exports hide it.
import { ProverWorkflow } from '../../node_modules/@openzeppelin/miden-multisig-client/dist/prover/workflow.js';

const remote = { kind: 'remote-prover' } as unknown as TransactionProver;
const local = { kind: 'local-prover' } as unknown as TransactionProver;
const accountId = {} as AccountId;
const request = {} as TransactionRequest;

function setup(prove: (options?: { prover?: TransactionProver }) => Promise<unknown>, kind: 'remote' | 'injected' = 'remote') {
  const apply = vi.fn(async () => {});
  const submit = vi.fn(async () => ({ apply }));
  const order: string[] = [];
  const execution = { prove: vi.fn(async (options?: { prover?: TransactionProver }) => {
    order.push(`prove:${(options?.prover as { kind?: string } | undefined)?.kind ?? 'default'}`);
    await prove(options);
    return { submit };
  }) };
  const client = {
    sync: vi.fn(async () => { order.push('sync'); }),
    transactions: { executeRequest: vi.fn<(accountId: AccountId, request: TransactionRequest) => Promise<typeof execution>>(async () => { order.push('execute'); return execution; }) },
  };
  const config = { kind, maxAttempts: 2, createProver: () => (kind === 'remote' ? remote : undefined) };
  const multisig = { proverWorkflow: new ProverWorkflow(client as never, config as never) };
  return { multisig, execution, client, submit, apply, order };
}

describe('configureProverWorkflow', () => {
  it('syncs to the tip before executing, then proves remotely when the prover works', async () => {
    const { multisig, apply, order } = setup(async () => {});
    const onFallback = vi.fn();
    expect(configureProverWorkflow(multisig, { onFallback, createLocalProver: () => local })).toBe(true);
    await multisig.proverWorkflow.submit(accountId, request);
    expect(order).toEqual(['sync', 'execute', 'prove:remote-prover']);
    expect(onFallback).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('re-executes at a fresh tip and proves locally when the remote prover drops the request', async () => {
    const aborted = new Error("failed to prove transaction: code: 'Unknown error', message: \"JS API error: AbortError: BodyStreamBuffer was aborted\"");
    const { multisig, client, submit, apply, order } = setup(async (options) => {
      if (options?.prover === remote) throw aborted;
    });
    const onFallback = vi.fn();
    configureProverWorkflow(multisig, { onFallback, createLocalProver: () => local });
    await multisig.proverWorkflow.submit(accountId, request);
    // The local proof gets its own window: sync and execute again before proving.
    expect(order).toEqual(['sync', 'execute', 'prove:remote-prover', 'sync', 'execute', 'prove:local-prover']);
    expect(client.transactions.executeRequest.mock.calls.every(([, req]) => req === request)).toBe(true);
    expect(onFallback).toHaveBeenCalledWith(aborted);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('surfaces the local error when the transaction cannot be proved at all', async () => {
    const invalid = new Error('transaction is invalid');
    const { multisig, submit } = setup(async () => { throw invalid; });
    configureProverWorkflow(multisig, { createLocalProver: () => local });
    await expect(multisig.proverWorkflow.submit(accountId, request)).rejects.toBe(invalid);
    expect(submit).not.toHaveBeenCalled();
  });

  it('still syncs before executing with in-browser proving, without a fallback', async () => {
    const invalid = new Error('boom');
    const { multisig, order } = setup(async () => { throw invalid; }, 'injected');
    const onFallback = vi.fn();
    expect(configureProverWorkflow(multisig, { onFallback })).toBe(true);
    await expect(multisig.proverWorkflow.submit(accountId, request)).rejects.toBe(invalid);
    expect(order).toEqual(['sync', 'execute', 'prove:default']);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('reports that Guardian accepted the push before proving starts', async () => {
    const { multisig, order } = setup(async () => {});
    configureProverWorkflow(multisig, { onPushed: () => order.push('pushed'), createLocalProver: () => local });
    await multisig.proverWorkflow.submit(accountId, request);
    expect(order[0]).toBe('pushed');
  });

  it('leaves unexpected shapes untouched', () => {
    expect(configureProverWorkflow({})).toBe(false);
    expect(configureProverWorkflow({ proverWorkflow: { submit() {} } })).toBe(false);
  });
});

describe('SDK drift guard', () => {
  it('Multisig still proves through `this.proverWorkflow.submit`', () => {
    const source = readFileSync(
      new URL('../../node_modules/@openzeppelin/miden-multisig-client/dist/multisig.js', import.meta.url),
      'utf8',
    );
    expect(source).toContain('this.proverWorkflow = new ProverWorkflow(this.midenClient,');
    expect(source).toContain('await this.proverWorkflow.submit(');
  });
});
