import { describe, expect, it } from 'vitest';
import { parseMidenNetwork } from '../../src/lib/midenNetwork';

describe('parseMidenNetwork', () => {
  it('takes the network name from env only, never from an endpoint', () => {
    expect(parseMidenNetwork('testnet')).toBe('testnet');
    expect(parseMidenNetwork(' Mainnet ')).toBe('mainnet');
    expect(parseMidenNetwork('custom')).toBe('custom');
  });

  it('requires a known name', () => {
    expect(() => parseMidenNetwork(undefined)).toThrow(/NEXT_PUBLIC_MIDEN_NETWORK is not set/);
    expect(() => parseMidenNetwork('  ')).toThrow(/NEXT_PUBLIC_MIDEN_NETWORK is not set/);
    expect(() => parseMidenNetwork('moonnet')).toThrow(/must be one of/);
  });
});

describe('registration invitation code per network', () => {
  it('defaults: testnet 00000, devnet the configured code, mainnet none (required)', async () => {
    const { defaultInvitationCode, invitationCodeRequired, registrationInvitationCode } = await import('../../src/lib/midenNetwork');
    expect(defaultInvitationCode('testnet', 'guardian')).toBe('00000');
    expect(defaultInvitationCode('devnet', 'guardian')).toBe('guardian');
    expect(defaultInvitationCode('mainnet', 'guardian')).toBe('');
    expect(invitationCodeRequired('mainnet')).toBe(true);
    expect(invitationCodeRequired('testnet')).toBe(false);
    // What the creator typed wins; otherwise the default.
    expect(registrationInvitationCode('testnet', 'guardian', ' mine ')).toBe('mine');
    expect(registrationInvitationCode('testnet', 'guardian', '')).toBe('00000');
    expect(registrationInvitationCode('mainnet', 'guardian', ' typed ')).toBe('typed');
    expect(() => registrationInvitationCode('mainnet', 'guardian', '  ')).toThrow(/invitation code is required/);
  });
});
