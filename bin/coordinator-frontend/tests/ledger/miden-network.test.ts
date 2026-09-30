import { describe, expect, it } from 'vitest';
import { resolveMidenNetwork } from '../../src/lib/midenNetwork';

describe('resolveMidenNetwork', () => {
  it('infers the network from the RPC shorthand or host', () => {
    expect(resolveMidenNetwork(undefined, 'devnet')).toBe('devnet');
    expect(resolveMidenNetwork('', 'testnet')).toBe('testnet');
    expect(resolveMidenNetwork(undefined, 'https://rpc.testnet.miden.io')).toBe('testnet');
    expect(resolveMidenNetwork(undefined, 'http://localhost:57291')).toBe('local');
    expect(resolveMidenNetwork(undefined, 'https://rpc.example.org')).toBe('custom');
  });

  it('lets NEXT_PUBLIC_MIDEN_NETWORK override the inference', () => {
    expect(resolveMidenNetwork('Testnet', 'https://rpc.example.org')).toBe('testnet');
    expect(() => resolveMidenNetwork('moonnet', 'devnet')).toThrow(/NEXT_PUBLIC_MIDEN_NETWORK/);
  });
});
