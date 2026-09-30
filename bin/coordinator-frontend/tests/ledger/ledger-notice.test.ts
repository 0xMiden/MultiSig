import { describe, expect, it } from 'vitest';
import { ledgerNotice } from '../../src/lib/ledgerNotice';

const base = { connected: false, accountLoaded: false, savedId: '0xdeadc17b13b218c14cfa7801d10884', address: null, error: null };

describe('ledgerNotice', () => {
  it('offers Connect Ledger after a reload or unplug, with the last error', () => {
    expect(ledgerNotice(base)).toMatchObject({ action: 'connect', label: 'Connect Ledger' });
    const unplugged = ledgerNotice({ ...base, error: 'Ledger disconnected. Reconnect and load your account again.' });
    expect(unplugged).toMatchObject({ action: 'connect', text: 'Ledger disconnected. Reconnect and load your account again.' });
  });

  it('offers to load the saved account once the Ledger is connected', () => {
    const notice = ledgerNotice({ ...base, connected: true, address: '0x1234567890abcdef1234' });
    expect(notice).toMatchObject({ action: 'load', label: 'Load account' });
    expect(notice.text).toContain('0xdeadc1…0884');
  });

  it('sends the user to choose an account when none was saved', () => {
    expect(ledgerNotice({ ...base, connected: true, savedId: null }).action).toBe('choose');
  });

  it('keeps a cancelled-operation error visible while the account is loaded', () => {
    const notice = ledgerNotice({ ...base, connected: true, accountLoaded: true, error: 'Ledger operation cancelled' });
    expect(notice).toMatchObject({ action: 'options', text: 'Ledger operation cancelled' });
  });
});
