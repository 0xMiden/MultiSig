import React, { type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountStatusBanner from '../../src/app/dashboard/components/AccountStatusBanner';

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

  it('keeps registration retry available after a rejected request', async () => {
    context.guardianRegistrationRequired = true;
    context.retryGuardianRegistration.mockRejectedValue(new Error('Ledger request rejected'));
    buttons(AccountStatusBanner())[0].props.onClick();
    await Promise.resolve();
    expect(context.handleSync).not.toHaveBeenCalled();
    expect(buttons(AccountStatusBanner())[0].props.children).toBe('Retry Guardian registration');
  });
});
