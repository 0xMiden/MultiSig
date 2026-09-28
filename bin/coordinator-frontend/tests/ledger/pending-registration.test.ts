import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountInspector, Multisig, type MultisigClient } from '@openzeppelin/miden-multisig-client';
import type { Signer } from '@openzeppelin/guardian-client';
import type { MidenClient } from '@miden-sdk/miden-sdk';
import { loadPendingMultisigAccount } from '../../src/lib/multisigApi';

vi.mock('@openzeppelin/miden-multisig-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@openzeppelin/miden-multisig-client')>(),
  Multisig: vi.fn(function () {}),
  AccountInspector: {
    getSignerPublicKeyCommitments: vi.fn(),
    getGuardianPublicKeyCommitment: vi.fn(),
    fromAccount: vi.fn(),
  },
}));
vi.mock('../../src/lib/midenDiagnostics', () => ({ instrumentMultisig: vi.fn() }));

const SIGNER_COMMITMENT = `0x${'01'.repeat(32)}`;
const GUARDIAN_COMMITMENT = `0x${'02'.repeat(32)}`;
const OTHER_COMMITMENT = `0x${'03'.repeat(32)}`;
const ACCOUNT_ID = 'local-pending-account';
const account = { nonce: () => ({ asInt: () => 0n }) };
const signer = { commitment: SIGNER_COMMITMENT, scheme: 'ecdsa' } as Signer;
const getAccount = vi.fn();
const guardian = { getPubkey: vi.fn(), setSigner: vi.fn(), configure: vi.fn() };
const client = { guardianClient: guardian } as unknown as MultisigClient;
const miden = { accounts: { get: getAccount } } as unknown as MidenClient;

describe('loading pending Guardian registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccount.mockResolvedValue(account);
    guardian.getPubkey.mockResolvedValue({ commitment: GUARDIAN_COMMITMENT, pubkey: 'guardian-public-key' });
    vi.mocked(AccountInspector.getSignerPublicKeyCommitments).mockReturnValue([SIGNER_COMMITMENT]);
    vi.mocked(AccountInspector.getGuardianPublicKeyCommitment).mockReturnValue(GUARDIAN_COMMITMENT);
    vi.mocked(AccountInspector.fromAccount).mockReturnValue({
      threshold: 1, numSigners: 1, signerCommitments: [SIGNER_COMMITMENT],
      guardianCommitment: GUARDIAN_COMMITMENT, vaultBalances: [], procedureThresholds: new Map(),
    });
  });

  it('restores the same account and signer without registering automatically', async () => {
    await loadPendingMultisigAccount(client, miden, ACCOUNT_ID, signer);
    expect(getAccount).toHaveBeenCalledWith(ACCOUNT_ID);
    expect(Multisig).toHaveBeenCalledWith(account, expect.objectContaining({
      signerCommitments: [SIGNER_COMMITMENT], guardianCommitment: GUARDIAN_COMMITMENT,
    }), guardian, signer, miden, ACCOUNT_ID, expect.any(String));
    expect(guardian.configure).not.toHaveBeenCalled();
  });

  it.each([null, { nonce: () => ({ asInt: () => 1n }) }])('rejects unavailable or used accounts', async (stored) => {
    getAccount.mockResolvedValue(stored);
    await expect(loadPendingMultisigAccount(client, miden, ACCOUNT_ID, signer)).rejects.toThrow('No unused local account');
    expect(Multisig).not.toHaveBeenCalled();
  });

  it('rejects a signer outside the stored approver set', async () => {
    vi.mocked(AccountInspector.getSignerPublicKeyCommitments).mockReturnValue([OTHER_COMMITMENT]);
    await expect(loadPendingMultisigAccount(client, miden, ACCOUNT_ID, signer)).rejects.toThrow('not authorized');
    expect(guardian.setSigner).not.toHaveBeenCalled();
  });

  it('rejects an endpoint whose Guardian key differs from the account', async () => {
    guardian.getPubkey.mockResolvedValue({ commitment: OTHER_COMMITMENT });
    await expect(loadPendingMultisigAccount(client, miden, ACCOUNT_ID, signer)).rejects.toThrow('different Guardian');
    expect(guardian.setSigner).not.toHaveBeenCalled();
  });
});
