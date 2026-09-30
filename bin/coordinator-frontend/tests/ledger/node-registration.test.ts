import { afterEach, describe, expect, it, vi } from 'vitest';

// Ported from scripts/test-registration.cjs. The RPC setting goes through the
// real config/psm.ts (so devnet is the resolved URL, as in production), and the
// direct devnet RPC and the SDK registration are counted separately.
async function setup({ rpc = 'devnet', allowed = true, rpcError, sdkError }: {
  rpc?: string; allowed?: boolean; rpcError?: Error; sdkError?: Error;
} = {}) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_MIDEN_RPC_URL', rpc);
  const calls = { devnetRpc: 0, sdkRegister: 0, isAllowed: 0 };
  vi.doMock('../../src/lib/devnetRegistration', () => ({
    registerDevnetAccount: async () => { calls.devnetRpc++; if (rpcError) throw rpcError; },
  }));
  const client = { accounts: {
    isAllowed: async () => { calls.isAllowed++; return allowed; },
    register: async () => { calls.sdkRegister++; if (sdkError) throw sdkError; },
  } };
  const { registerAccountOnNode } = await import('../../src/lib/multisigApi');
  return { run: () => registerAccountOnNode(client as never, '0x1234'), calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('../../src/lib/devnetRegistration');
});

describe('registerAccountOnNode', () => {
  it.each(['devnet', 'https://rpc.devnet.miden.io', 'https://rpc.devnet.miden.io:443/'])(
    'devnet (%s) requests funding over RPC even when every account is allowed, once for concurrent calls',
    async (rpc) => {
      const { run, calls } = await setup({ rpc });
      const first = run();
      expect(run()).toBe(first);
      await first;
      expect(calls).toEqual({ devnetRpc: 1, sdkRegister: 0, isAllowed: 0 });
    },
  );

  it.each(['ALREADY_REGISTERED', 'account is already registered'])(
    'accepts a duplicate devnet registration (%s) only once the node allows the account',
    async (message) => {
      const accepted = await setup({ rpcError: new Error(message) });
      await accepted.run();
      expect(accepted.calls).toEqual({ devnetRpc: 1, sdkRegister: 0, isAllowed: 1 });
      const rejected = await setup({ rpcError: new Error(message), allowed: false });
      await expect(rejected.run()).rejects.toThrow(/registered/i);
    },
  );

  it('propagates real RPC errors and lets a failed request be retried', async () => {
    const error = new Error('INVITATION_NOT_FOUND');
    const { run, calls } = await setup({ rpcError: error });
    await expect(run()).rejects.toBe(error);
    await expect(run()).rejects.toBe(error);
    expect(calls.devnetRpc).toBe(2);
    expect(calls.isAllowed).toBe(0);
  });

  it.each(['testnet', 'https://rpc.example.org', 'https://rpc.devnet.miden.io.evil.io'])(
    'outside devnet (%s) registers through the SDK, and only when the node does not allow the account',
    async (rpc) => {
      const open = await setup({ rpc });
      await open.run();
      expect(open.calls).toEqual({ devnetRpc: 0, sdkRegister: 0, isAllowed: 1 });
      const gated = await setup({ rpc, allowed: false });
      await gated.run();
      expect(gated.calls).toEqual({ devnetRpc: 0, sdkRegister: 1, isAllowed: 1 });
    },
  );
});
