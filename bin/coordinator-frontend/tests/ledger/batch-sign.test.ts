import { describe, expect, it } from 'vitest';
import { signEach } from '../../src/lib/batchSign';

describe('signEach', () => {
  it('keeps each failure and its reason when later items succeed', async () => {
    const result = await signEach(['a', 'b', 'c'], async (id) => {
      if (id === 'a') throw new Error('Ledger rejected');
      if (id === 'b') throw 'Guardian unavailable';
    });
    expect(result.signed).toEqual(['c']);
    expect(result.failed).toEqual([
      { id: 'a', message: 'Ledger rejected' },
      { id: 'b', message: 'Guardian unavailable' },
    ]);
  });

  it('signs in order, one at a time', async () => {
    const order: string[] = [];
    await signEach(['x', 'y'], async (id) => { order.push(`start ${id}`); await Promise.resolve(); order.push(`end ${id}`); });
    expect(order).toEqual(['start x', 'end x', 'start y', 'end y']);
  });
});
