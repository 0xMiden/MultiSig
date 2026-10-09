import { describe, expect, it } from 'vitest';
import * as M from '@miden-sdk/miden-sdk';
import { PROCEDURE_ROOTS } from '@openzeppelin/miden-multisig-client';

// @openzeppelin/miden-multisig-client hard-codes the procedure roots it uses
// for per-procedure thresholds and proposal checks. We force a single Miden SDK
// version for it (package.json overrides), so check those roots still exist in
// an account built the way the client builds one. If an SDK bump changes them,
// thresholds would silently point at nothing.
describe('multisig procedure roots match the installed Miden SDK', () => {
  it('every hard-coded root is a procedure of a guarded-multisig + basic-wallet account', () => {
    const word = (n: bigint) => M.Word.fromHex(new M.Word(new BigUint64Array([n, 2n, 3n, 4n])).toHex());
    const config = new M.AuthGuardedMultisigConfig([word(1n)], 1, word(9n), 2 as never);
    const account = new M.AccountBuilder(new Uint8Array(32).fill(3))
      .storageMode(M.AccountStorageMode.private())
      .withAuthComponent(M.createAuthGuardedMultisig(config).withSupportsAllTypes())
      .withBasicWalletComponent()
      .buildWithoutSchemaCommitment().account;
    const code = account.code();
    const missing = Object.entries(PROCEDURE_ROOTS).filter(([, root]) => !code.hasProcedure(M.Word.fromHex(root)));
    expect(missing).toEqual([]);
  });
});
