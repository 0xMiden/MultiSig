import { afterEach, describe, expect, it, vi } from 'vitest';

// Ported from scripts/test-rpc-config.cjs: config/psm.ts is evaluated through
// the real module graph, one fresh copy per environment.
async function config(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value as string);
  return import('../../src/config/psm');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@openzeppelin/miden-multisig-client');
});

describe('RPC configuration', () => {
  it.each([
    [undefined, 'https://rpc.devnet.miden.io'],
    ['devnet', 'https://rpc.devnet.miden.io'],
    [' DEVNET ', 'https://rpc.devnet.miden.io'],
    ['testnet', 'https://rpc.testnet.miden.io'],
    ['local', 'http://localhost:57291'],
    ['localhost', 'http://localhost:57291'],
    [' https://custom.example:443/rpc ', 'https://custom.example:443/rpc'],
  ])('resolves %j to %s', async (value, expected) => {
    const { MIDEN_RPC_URL } = await config({ NEXT_PUBLIC_MIDEN_RPC_URL: value });
    expect(MIDEN_RPC_URL).toBe(expected);
  });

  it('derives the network identity from the same setting', async () => {
    expect((await config({ NEXT_PUBLIC_MIDEN_RPC_URL: 'testnet' })).MIDEN_NETWORK).toBe('testnet');
    expect((await config({ NEXT_PUBLIC_MIDEN_RPC_URL: 'https://rpc.example.org', NEXT_PUBLIC_MIDEN_NETWORK: 'devnet' })).MIDEN_NETWORK).toBe('devnet');
  });

  it('gives Guardian the full devnet RPC URL, never the shorthand', async () => {
    let received: { midenRpcEndpoint?: string } | undefined;
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_MIDEN_RPC_URL', 'devnet');
    vi.doMock('@openzeppelin/miden-multisig-client', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      MultisigClient: class {
        guardianClient = { getPubkey: async () => ({ commitment: 'commitment' }) };
        constructor(_client: unknown, options: { midenRpcEndpoint?: string }) { received = options; }
      },
    }));
    const { initMultisigClient } = await import('../../src/lib/multisigApi');
    await initMultisigClient({} as never, 'https://guardian.example');
    expect(received?.midenRpcEndpoint).toBe('https://rpc.devnet.miden.io');
  });
});
