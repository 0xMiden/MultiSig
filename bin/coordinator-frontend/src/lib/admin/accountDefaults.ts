import type { ProcedureThreshold } from '@openzeppelin/miden-multisig-client';

/**
 * Per-procedure thresholds a multisig created in the admin build starts with: receiving notes
 * takes a single signer, whatever the account's default threshold is. An admin multisig pays
 * every fee from its own vault, so any signer has to be able to top it up without gathering the
 * signatures an admin action needs; receiving only ever adds assets to the account.
 *
 * Returns `undefined` when the default threshold is already 1, where an override would change
 * nothing.
 */
export function adminProcedureThresholds(defaultThreshold: number): ProcedureThreshold[] | undefined {
  if (defaultThreshold <= 1) return undefined;
  return [{ procedure: 'receive_asset', threshold: 1 }];
}
