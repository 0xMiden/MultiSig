import { afterEach, describe, expect, it, vi } from 'vitest';

// config/psm.ts is evaluated through
// the real module graph, one fresh copy per environment.
const FULL = {
  NEXT_PUBLIC_MIDEN_NETWORK: 'testnet',
  NEXT_PUBLIC_MIDEN_RPC_URL: 'https://rpc.example.org',
  NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL: 'https://transport.example.org',
  NEXT_PUBLIC_MIDEN_PROVER_URL: 'https://prover.example.org',
};

async function config(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value as string);
  return import('../../src/config/psm');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@openzeppelin/miden-multisig-client');
});

describe('network configuration from env', () => {
  it('uses the full URLs and network exactly as configured', async () => {
    const c = await config({ ...FULL, NEXT_PUBLIC_MIDEN_RPC_URL: ' https://custom.example:443/rpc ' });
    expect(c.CONFIG_ERRORS).toEqual([]);
    expect(c.MIDEN_NETWORK).toBe('testnet');
    expect(c.MIDEN_RPC_URL).toBe('https://custom.example:443/rpc');
    expect(c.MIDEN_NOTE_TRANSPORT_URL).toBe('https://transport.example.org');
    expect(c.MIDEN_PROVER_URL).toBe('https://prover.example.org');
  });

  it('proves in the browser when the prover is unset or "local"', async () => {
    expect((await config({ ...FULL, NEXT_PUBLIC_MIDEN_PROVER_URL: '' })).MIDEN_PROVER_URL).toBe('local');
    const local = await config({ ...FULL, NEXT_PUBLIC_MIDEN_PROVER_URL: ' Local ' });
    expect(local.MIDEN_PROVER_URL).toBe('local');
    expect(local.CONFIG_ERRORS).toEqual([]);
  });

  it('has no built-in endpoints: unset values are reported, not defaulted', async () => {
    const c = await config({
      NEXT_PUBLIC_MIDEN_NETWORK: '',
      NEXT_PUBLIC_MIDEN_RPC_URL: '',
      NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL: '',
      NEXT_PUBLIC_MIDEN_PROVER_URL: '',
    });
    expect(c.MIDEN_RPC_URL).toBe('');
    expect(c.MIDEN_NOTE_TRANSPORT_URL).toBe('');
    expect(c.CONFIG_ERRORS).toEqual([
      expect.stringMatching(/NEXT_PUBLIC_MIDEN_NETWORK is not set/),
      'NEXT_PUBLIC_MIDEN_RPC_URL is not set.',
      'NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL is not set.',
    ]);
  });

  it.each(['testnet', 'devnet', 'rpc.testnet.miden.io', 'ftp://rpc.example.org'])(
    'rejects %j: endpoints must be full http(s) URLs (no network shorthands)',
    async (value) => {
      const c = await config({ ...FULL, NEXT_PUBLIC_MIDEN_RPC_URL: value, NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL: value, NEXT_PUBLIC_MIDEN_PROVER_URL: value });
      expect(c.MIDEN_RPC_URL).toBe('');
      expect(c.CONFIG_ERRORS).toEqual([
        `NEXT_PUBLIC_MIDEN_RPC_URL must be a full http(s) URL; got "${value}".`,
        `NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL must be a full http(s) URL; got "${value}".`,
        `NEXT_PUBLIC_MIDEN_PROVER_URL must be a full http(s) URL or "local"; got "${value}".`,
      ]);
    },
  );

  it('allows the default Guardian plus NEXT_PUBLIC_GUARDIAN_ENDPOINTS, and reports bad entries', async () => {
    const c = await config({
      ...FULL,
      NEXT_PUBLIC_GUARDIAN_ENDPOINT: 'https://guardian-a.example',
      NEXT_PUBLIC_GUARDIAN_ENDPOINTS: ' https://guardian-b.example, https://guardian-a.example  https://guardian-c.example/api ',
    });
    expect(c.GUARDIAN_ENDPOINTS).toEqual(['https://guardian-a.example', 'https://guardian-b.example', 'https://guardian-c.example/api']);
    expect(c.CONFIG_ERRORS).toEqual([]);
    const bad = await config({ ...FULL, NEXT_PUBLIC_GUARDIAN_ENDPOINT: '', NEXT_PUBLIC_GUARDIAN_ENDPOINTS: 'guardian-b.example' });
    expect(bad.GUARDIAN_ENDPOINTS).toEqual([]);
    expect(bad.CONFIG_ERRORS).toEqual(['NEXT_PUBLIC_GUARDIAN_ENDPOINTS entry must be a full http(s) URL; got "guardian-b.example".']);
  });

  it('reports an unknown network name', async () => {
    const c = await config({ ...FULL, NEXT_PUBLIC_MIDEN_NETWORK: 'moonnet' });
    expect(c.CONFIG_ERRORS).toEqual([expect.stringMatching(/NEXT_PUBLIC_MIDEN_NETWORK must be one of .*"moonnet"/)]);
  });

  it('refuses to start the client while misconfigured, without resetting local data', async () => {
    const { assertConfigured } = await import('../../src/lib/clientStartup');
    expect(() => assertConfigured([])).not.toThrow();
    expect(() => assertConfigured(['NEXT_PUBLIC_MIDEN_RPC_URL is not set.'])).toThrow(
      'This deployment is misconfigured: NEXT_PUBLIC_MIDEN_RPC_URL is not set.',
    );
  });

  it('gives Guardian the configured RPC URL', async () => {
    let received: { midenRpcEndpoint?: string } | undefined;
    vi.resetModules();
    for (const [name, value] of Object.entries(FULL)) vi.stubEnv(name, value);
    vi.doMock('@openzeppelin/miden-multisig-client', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      MultisigClient: class {
        guardianClient = { getPubkey: async () => ({ commitment: 'commitment' }) };
        constructor(_client: unknown, options: { midenRpcEndpoint?: string }) { received = options; }
      },
    }));
    const { initMultisigClient } = await import('../../src/lib/multisigApi');
    await initMultisigClient({} as never, 'https://guardian.example');
    expect(received?.midenRpcEndpoint).toBe('https://rpc.example.org');
  });
});
