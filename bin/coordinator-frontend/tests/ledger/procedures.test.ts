import { describe, expect, it } from 'vitest';
import { getEffectiveThreshold, getProposalProcedure, planRemoveSigner } from '../../src/lib/procedures';

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

describe('planRemoveSigner (review finding 7)', () => {
  it('keeps the current threshold while enough signers remain', () => {
    expect(planRemoveSigner(2, 4)).toEqual({ approvalsRequired: 2, remainingSigners: 3, newThreshold: 2, thresholdChanges: false });
  });

  it('lowers the threshold only as far as the signers left', () => {
    expect(planRemoveSigner(3, 3)).toMatchObject({ newThreshold: 2, remainingSigners: 2, thresholdChanges: true });
  });

  it('never raises the default threshold from a per-procedure override', () => {
    // 2-of-4 with update_signers needing 4: removal needs 4 approvals, but the
    // account stays 2-of-3 instead of becoming 3-of-3.
    const plan = planRemoveSigner(2, 4, new Map([['update_signers', 4]]));
    expect(plan).toEqual({ approvalsRequired: 4, remainingSigners: 3, newThreshold: 2, thresholdChanges: false });
  });
});
