import React, { type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountStatusBanner from '../../src/app/dashboard/components/AccountStatusBanner';
import { runRegistrationRetry } from '../../src/lib/registrationRetry';

const context = vi.hoisted(() => ({
  error: 'Account not found on Guardian',
  pendingCandidateWarning: null,
  accountFunding: { phase: 'idle' },
  multisig: {},
  detectedConfig: {},
  loadingAccount: false,
  registeringOnGuardian: false,
  syncingState: false,
  guardianRegistrationRequired: false,
  handleSync: vi.fn(),
  retryGuardianRegistration: vi.fn(),
  retryAccountFunding: vi.fn(),
}));

vi.mock('../../src/contexts/MultisigContext', () => ({ useMultisig: () => context }));

function buttons(node: ReactNode): ReactElement<{ children: string; disabled: boolean; onClick: () => void }>[] {
  if (!React.isValidElement<{ children?: ReactNode }>(node)) return [];
  if (node.type === 'button') return [node as ReturnType<typeof buttons>[number]];
  return React.Children.toArray(node.props.children).flatMap(buttons);
}

describe('Guardian registration recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    context.guardianRegistrationRequired = false;
    context.registeringOnGuardian = false;
    context.handleSync.mockResolvedValue(undefined);
    context.retryGuardianRegistration.mockResolvedValue(undefined);
  });

  it.each([false, true])('routes retry with registration required=%s', (required) => {
    context.guardianRegistrationRequired = required;
    const [button] = buttons(AccountStatusBanner());
    expect(button.props.children).toBe(required ? 'Retry Guardian registration' : 'Retry');
    button.props.onClick();
    expect(context.retryGuardianRegistration).toHaveBeenCalledTimes(required ? 1 : 0);
    expect(context.handleSync).toHaveBeenCalledTimes(required ? 0 : 1);
  });

  it('disables retry during a registration request', () => {
    context.guardianRegistrationRequired = true;
    context.registeringOnGuardian = true;
    const [button] = buttons(AccountStatusBanner());
    expect(button.props.disabled).toBe(true);
  });

  it('handles a rejected retry instead of leaving an unhandled rejection', async () => {
    context.guardianRegistrationRequired = true;
    // A plain function: a vi.fn() spy observes its own promise, which would
    // hide exactly the unhandled rejection this test is about.
    let calls = 0;
    const original = context.retryGuardianRegistration;
    context.retryGuardianRegistration = (() => { calls += 1; return Promise.reject(new Error('Ledger request rejected')); }) as typeof original;
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    try {
      buttons(AccountStatusBanner())[0].props.onClick();
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(calls).toBe(1);
      expect(context.handleSync).not.toHaveBeenCalled();
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      context.retryGuardianRegistration = original;
    }
  });
});

describe('runRegistrationRetry', () => {
  const steps = () => ({
    register: vi.fn(async () => {}),
    sessionUnchanged: vi.fn(() => true),
    registerNoteTag: vi.fn(async () => {}),
    requestFunding: vi.fn(async () => {}),
    sync: vi.fn(async () => {}),
  });

  it('clears the requirement only after Guardian accepted the registration', async () => {
    const s = steps();
    expect(await runRegistrationRetry(s)).toEqual({ registered: true, error: null });
    expect(s.register).toHaveBeenCalledTimes(1);
    expect(s.registerNoteTag).toHaveBeenCalledTimes(1);
    expect(s.sync).toHaveBeenCalledTimes(1);
  });

  it('keeps the requirement, and skips everything after, when the signer rejects', async () => {
    const s = steps();
    const rejection = new Error('Ledger request rejected');
    s.register.mockRejectedValue(rejection);
    expect(await runRegistrationRetry(s)).toEqual({ registered: false, error: rejection });
    expect(s.registerNoteTag).not.toHaveBeenCalled();
    expect(s.sync).not.toHaveBeenCalled();
    // A second attempt runs the registration again.
    s.register.mockResolvedValue(undefined);
    expect((await runRegistrationRetry(s)).registered).toBe(true);
    expect(s.register).toHaveBeenCalledTimes(2);
  });

  it('keeps the requirement when the Ledger session changed during registration', async () => {
    const s = steps();
    s.sessionUnchanged.mockReturnValue(false);
    const result = await runRegistrationRetry(s);
    expect(result.registered).toBe(false);
    expect(String(result.error)).toMatch(/session changed/);
    expect(s.registerNoteTag).not.toHaveBeenCalled();
  });

  it('does not let a funding failure block the retry', async () => {
    const s = steps();
    s.requestFunding.mockRejectedValue(new Error('faucet down'));
    expect(await runRegistrationRetry(s)).toEqual({ registered: true, error: null });
    expect(s.sync).toHaveBeenCalledTimes(1);
  });

  it('reports a later failure without undoing the registration', async () => {
    const s = steps();
    const failure = new Error('sync failed');
    s.sync.mockRejectedValue(failure);
    expect(await runRegistrationRetry(s)).toEqual({ registered: true, error: failure });
  });
});
