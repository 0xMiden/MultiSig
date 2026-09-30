import { describe, expect, it, vi } from 'vitest';
import { startWithStoreReset, waitForClientParts, type StartupState } from '../../src/lib/clientStartup';

describe('startWithStoreReset', () => {
  it('starts without touching the store when the first attempt works', async () => {
    const reset = vi.fn(async () => {});
    await expect(startWithStoreReset(async () => 'client', reset)).resolves.toBe('client');
    expect(reset).not.toHaveBeenCalled();
  });

  it('resets the store once and retries when start-up fails (e.g. an old store)', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('VersionError: stale MidenClientDB')).mockResolvedValue('client');
    const reset = vi.fn(async () => {});
    const onReset = vi.fn();
    await expect(startWithStoreReset(create, reset, onReset)).resolves.toBe('client');
    expect(reset).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
    expect(onReset).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('VersionError') }));
  });

  it('reports both errors if it still fails after the reset, and does not loop', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('first')).mockRejectedValueOnce(new Error('second'));
    const reset = vi.fn(async () => {});
    await expect(startWithStoreReset(create, reset)).rejects.toThrow(/could not start.*second.*first/);
    expect(create).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('waitForClientParts', () => {
  const parts = { midenClient: 'miden', multisigClient: 'multisig', guardianCommitment: '0xabc' };
  const sleep = async () => {};

  it('returns the parts as soon as the client is ready, instead of failing early clicks', async () => {
    let checks = 0;
    const current = () => (++checks >= 3 ? parts : null);
    await expect(waitForClientParts(current, () => ({ phase: 'starting' }), { sleep })).resolves.toEqual(parts);
    expect(checks).toBe(3);
  });

  it('fails with the real start-up error', async () => {
    const failed: StartupState = { phase: 'error', error: 'The Miden client could not start: boom' };
    await expect(waitForClientParts(() => null, () => failed, { sleep })).rejects.toThrow('could not start: boom');
  });

  it('gives up after the timeout with a clear message', async () => {
    await expect(waitForClientParts(() => null, () => ({ phase: 'starting' }), { sleep, timeoutMs: 1_000, pollMs: 200 }))
      .rejects.toThrow('still starting');
  });
});
