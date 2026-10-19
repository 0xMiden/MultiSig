import { describe, it, expect } from 'vitest';
import { getNetworkNoteConsumption, isNoteConsumed } from '@/lib/customNote/consumption';

const NOTE = '0x' + 'ab'.repeat(32);

describe('isNoteConsumed', () => {
  it('is true once this client lists the note as consumed, false while unknown or unconsumed', async () => {
    const client = (records: { isConsumed(): boolean }[]) => ({ notes: { list: async () => records } });
    expect(await isNoteConsumed(client([]), NOTE)).toBe(false);
    expect(await isNoteConsumed(client([{ isConsumed: () => false }]), NOTE)).toBe(false);
    expect(await isNoteConsumed(client([{ isConsumed: () => true }]), NOTE)).toBe(true);
  });
});

describe('getNetworkNoteConsumption maps the node\'s network-transaction-builder view', () => {
  const rpc = (status: string, lastError?: string) => ({ getNetworkNoteStatus: async () => ({ status, lastError }) as never });

  it('applied once the nullifier committed', async () => {
    expect(await getNetworkNoteConsumption(NOTE, rpc('NullifierCommitted'))).toEqual({ state: 'applied' });
  });
  it('failed with the node\'s reason once discarded', async () => {
    expect(await getNetworkNoteConsumption(NOTE, rpc('Discarded', 'max supply exceeded'))).toEqual({ state: 'failed', detail: 'max supply exceeded' });
    expect(await getNetworkNoteConsumption(NOTE, rpc('Discarded'))).toEqual({ state: 'failed', detail: 'The network account discarded this note.' });
  });
  it('awaiting while pending or in flight, carrying the last error when one was attempted', async () => {
    expect(await getNetworkNoteConsumption(NOTE, rpc('Pending'))).toEqual({ state: 'awaiting_consumption', detail: undefined });
    expect(await getNetworkNoteConsumption(NOTE, rpc('NullifierInflight', 'retrying'))).toEqual({ state: 'awaiting_consumption', detail: 'retrying' });
  });
  it('not_found when the node has no record of the note, other errors propagate', async () => {
    expect(await getNetworkNoteConsumption(NOTE, { getNetworkNoteStatus: async () => { throw new Error('note not found'); } })).toBe('not_found');
    await expect(getNetworkNoteConsumption(NOTE, { getNetworkNoteStatus: async () => { throw new Error('connection refused'); } })).rejects.toThrow(/refused/);
  });
});
