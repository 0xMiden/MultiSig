import { describe, expect, it, vi } from 'vitest';
import { GuardianSessionsUnsupportedError, SessionGrantDeclinedError } from '@openzeppelin/miden-multisig-client';
import { GuardianHttpError } from '@openzeppelin/guardian-client';
import { openGuardianSession, walletUsesSessions, type SessionClient } from '../../src/lib/guardianSession';

const store = { load: vi.fn(), save: vi.fn(), remove: vi.fn() };
const session = { expiresAt: 1_800_028_740 } as never;
const signer = (requestAuthFormat?: 'eip712') => ({ commitment: '0xabc', scheme: 'ecdsa', requestAuthFormat }) as never;

function client(resumed: unknown, start: () => Promise<unknown> = async () => session) {
  const calls: { start: Array<{ confirm?: unknown }> } = { start: [] };
  const c: SessionClient = {
    resumeSession: vi.fn(async () => resumed as never),
    startSession: vi.fn(async (_signer, options) => { calls.start.push({ confirm: options?.confirm }); return start() as never; }),
  };
  return { c, calls };
}
const options = { store, confirm: async () => true, onEnded: () => {} };

describe('Guardian session on wallet connect', () => {
  it('only external wallets use sessions: local keys never prompt', () => {
    expect(walletUsesSessions('local')).toBe(false);
    for (const source of ['ledger', 'para', 'miden-wallet'] as const) expect(walletUsesSessions(source)).toBe(true);
  });

  it('resumes the stored session without asking the wallet', async () => {
    const { c } = client(session);
    await expect(openGuardianSession(c, signer(), options)).resolves.toEqual({ state: { phase: 'active', expiresAt: 1_800_028_740 }, session });
    expect(c.startSession).not.toHaveBeenCalled();
  });

  it('starts one when none is stored, asking the user first only for wallets that sign a hash', async () => {
    const raw = client(null);
    await openGuardianSession(raw.c, signer(), options);
    expect(raw.calls.start[0].confirm).toBe(options.confirm);
    const ledger = client(null);
    await openGuardianSession(ledger.c, signer('eip712'), options);
    expect(ledger.calls.start[0].confirm).toBeUndefined();
  });

  it('reports a Guardian without sessions, a declined grant, a wallet with no account yet and other failures as states', async () => {
    const unsupported = client(null, async () => { throw new GuardianSessionsUnsupportedError(); });
    await expect(openGuardianSession(unsupported.c, signer(), options)).resolves.toEqual({ state: { phase: 'unsupported' }, session: null });
    const declined = client(null, async () => { throw new SessionGrantDeclinedError(); });
    await expect(openGuardianSession(declined.c, signer(), options)).resolves.toMatchObject({ state: { phase: 'failed', message: expect.stringMatching(/declined/) } });
    const failed = client(null, async () => { throw new Error('wallet closed'); });
    await expect(openGuardianSession(failed.c, signer(), options)).resolves.toEqual({ state: { phase: 'failed', message: 'Could not start a Guardian session: wallet closed' }, session: null });
    const notCosigner = client(null, async () => { throw new GuardianHttpError(403, 'Forbidden', JSON.stringify({ error: "You're not an authorized signer for this account." })); });
    await expect(openGuardianSession(notCosigner.c, signer(), options)).resolves.toEqual({ state: { phase: 'waiting' }, session: null });
  });
});
