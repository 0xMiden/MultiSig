import { describe, it, expect } from 'vitest';
import { adminProcedureThresholds } from '@/lib/admin/accountDefaults';
import { getEffectiveThreshold } from '@/lib/procedures';

describe('adminProcedureThresholds', () => {
  it('lets a single signer receive notes on a multisig that needs more for everything else', () => {
    expect(adminProcedureThresholds(3)).toEqual([{ procedure: 'receive_asset', threshold: 1 }]);
  });

  it('adds no override when the default threshold is already 1', () => {
    expect(adminProcedureThresholds(1)).toBeUndefined();
  });

  it('lowers only receiving: admin actions and signer changes keep the default threshold', () => {
    const overrides = new Map(adminProcedureThresholds(3)!.map((t) => [t.procedure, t.threshold]));
    expect(getEffectiveThreshold('consume_notes', 3, overrides)).toBe(1);
    expect(getEffectiveThreshold('custom', 3, overrides)).toBe(3);
    expect(getEffectiveThreshold('p2id', 3, overrides)).toBe(3);
    expect(getEffectiveThreshold('add_signer', 3, overrides)).toBe(3);
    expect(getEffectiveThreshold('update_procedure_threshold', 3, overrides)).toBe(3);
  });
});
