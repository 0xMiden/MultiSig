import { describe, expect, it } from 'vitest';
import { getEffectiveThreshold, getProposalProcedure } from '../../src/lib/procedures';

describe('procedure thresholds (review C2)', () => {
  it('maps update_procedure_threshold proposals to their own procedure', () => {
    expect(getProposalProcedure('update_procedure_threshold')).toBe('update_procedure_threshold');
  });

  it('uses the procedure threshold instead of the global default', () => {
    const thresholds = new Map([['update_procedure_threshold', 3], ['send_asset', 2]] as const);
    expect(getEffectiveThreshold('update_procedure_threshold', 1, new Map(thresholds))).toBe(3);
    expect(getEffectiveThreshold('p2id', 1, new Map(thresholds))).toBe(2);
    expect(getEffectiveThreshold('update_procedure_threshold', 1, new Map())).toBe(1);
  });
});
