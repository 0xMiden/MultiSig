export interface LedgerNoticeInput {
  connected: boolean;
  accountLoaded: boolean;
  /** The account last loaded in this browser, if any. */
  savedId: string | null;
  address: string | null;
  error: string | null;
}

export type LedgerNoticeAction = 'connect' | 'load' | 'options' | 'choose';

export interface LedgerNotice {
  title: string;
  text: string;
  action: LedgerNoticeAction;
  label: string;
}

/**
 * What the dashboard tells a Ledger user, and the one next step it offers:
 * connect the device, load the account with it, or (once both are done)
 * reopen the Ledger options. The last Ledger error always takes the text.
 */
export function ledgerNotice({ connected, accountLoaded, savedId, address, error }: LedgerNoticeInput): LedgerNotice {
  if (!connected) {
    return {
      title: 'Ledger not connected',
      text: error ?? 'Connect your Ledger to load this account and sign with it.',
      action: 'connect',
      label: 'Connect Ledger',
    };
  }
  if (accountLoaded) {
    return { title: 'Ledger', text: error ?? 'Ledger connected.', action: 'options', label: 'Ledger options' };
  }
  if (!savedId) {
    return {
      title: 'Account not loaded',
      text: error ?? 'Your Ledger is connected. Choose the account to load with it.',
      action: 'choose',
      label: 'Choose an account',
    };
  }
  return {
    title: 'Account not loaded',
    text: error ?? `Ledger ${address ? shortId(address) + ' ' : ''}is connected. Load ${shortId(savedId)} with it to continue.`,
    action: 'load',
    label: 'Load account',
  };
}

function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}
