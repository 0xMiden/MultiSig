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

describe('funding and invitation codes (review of 0xMiden/MultiSig#33)', () => {
  it('waits for a funding note only on testnet', async () => {
    const { fundsOnRegistration } = await import('../../src/lib/midenNetwork');
    expect(fundsOnRegistration('testnet')).toBe(true);
    for (const network of ['devnet', 'mainnet', 'local', 'custom'] as const) expect(fundsOnRegistration(network)).toBe(false);
  });

  it('checks a required invitation code with the node first, passing on its error', async () => {
    const { assertInvitationCodeValid } = await import('../../src/lib/midenNetwork');
    const { UserFacingError } = await import('../../src/lib/errors');
    await expect(assertInvitationCodeValid({ isInvitationCodeValid: async () => true }, 'INVITE-1')).resolves.toBeUndefined();
    const rejected = assertInvitationCodeValid({ isInvitationCodeValid: async () => false }, 'TYPO');
    await expect(rejected).rejects.toThrow(/node rejected this invitation code.*nothing was created/);
    await expect(rejected).rejects.toBeInstanceOf(UserFacingError);
    await expect(assertInvitationCodeValid({ isInvitationCodeValid: async () => { throw new Error('INVITATION_NOT_FOUND'); } }, 'X'))
      .rejects.toThrow('The node could not check the invitation code: INVITATION_NOT_FOUND');
  });

  it('goes ahead when the node predates the check (UNIMPLEMENTED on testnet/devnet 0.17.1)', async () => {
    const { assertInvitationCodeValid } = await import('../../src/lib/midenNetwork');
    // The SDK 0.17.3 message, as returned live by rpc.testnet.miden.io on 2026-10-12.
    const unimplemented = new Error("failed to check whether the invitation code is valid: RPC error: grpc request failed for is_invitation_code_valid: the requested method is not implemented by this version of the Miden node: code: 'Operation is not implemented or not supported'");
    await expect(assertInvitationCodeValid({ isInvitationCodeValid: async () => { throw unimplemented; } }, 'CODE')).resolves.toBeUndefined();
  });
});
