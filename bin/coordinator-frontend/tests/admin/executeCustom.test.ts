import { describe, it, expect, vi } from 'vitest';
import { executeCustomProposal, runCustomExecution } from '@/lib/admin/adminExecute';
import type { AdminRecipe } from '@/lib/admin/recipe';

// `runCustomExecution` is the DI seam: `buildReq`/`buildBuilder` stand in for
// `buildAdminTransactionRequest`/`buildAdminTransactionRequestBuilder`, which both need a live
// `MidenClient` and are therefore not unit-tested here (see adminRequest.ts doc comments).

const recipe: AdminRecipe = {
  recipeVersion: 1,
  action: 'pause',
  senderAccountId: '0xabc',
  faucetId: '0xfff',
  feeFaucetId: '0xfee',
  networkId: 'devnet',
  actionArgs: { action: 'pause' },
  saltHex: '0x' + '1'.repeat(64),
  boundBlockNum: 42,
};

const FIXED_BYTES = new Uint8Array([9, 9, 9]);
const SENTINEL_ADVICE = { __sentinelAdvice: true };

describe('runCustomExecution', () => {
  it('prepares execution advice from the first build, then submits the advice-folded request from a fresh builder', async () => {
    const calls: string[] = [];
    const prepareCustomExecution = vi.fn().mockImplementation(async () => {
      calls.push('prepare');
      return SENTINEL_ADVICE;
    });
    const submitTransaction = vi.fn().mockImplementation(async () => {
      calls.push('submit');
    });
    const ms = { prepareCustomExecution, submitTransaction };

    const buildReq = vi.fn().mockResolvedValue({ request: { serialize: () => FIXED_BYTES } });
    const finalRequest = { __final: true };
    const extendAdviceMap = vi.fn().mockReturnValue({ build: () => finalRequest });
    const builder = { extendAdviceMap };
    const buildBuilder = vi.fn().mockResolvedValue({ builder });

    await runCustomExecution(ms, recipe, buildReq, buildBuilder, 'proposal-1');

    expect(buildReq).toHaveBeenCalledWith(recipe);
    expect(prepareCustomExecution).toHaveBeenCalledTimes(1);
    expect(prepareCustomExecution).toHaveBeenCalledWith('proposal-1', FIXED_BYTES);

    expect(buildBuilder).toHaveBeenCalledWith(recipe);
    expect(extendAdviceMap).toHaveBeenCalledTimes(1);
    expect(extendAdviceMap).toHaveBeenCalledWith(SENTINEL_ADVICE);

    expect(submitTransaction).toHaveBeenCalledTimes(1);
    expect(submitTransaction).toHaveBeenCalledWith('proposal-1', finalRequest);

    // prepare-then-submit ordering.
    expect(calls).toEqual(['prepare', 'submit']);
  });
});

describe('executeCustomProposal', () => {
  // The happy path (resolve recipe -> rebuild request -> prepare -> rebuild builder -> submit)
  // needs a live `MidenClient` to build against (`buildAdminTransactionRequest`/
  // `buildAdminTransactionRequestBuilder`), so it is not unit-tested end to end here — see the
  // `runCustomExecution` tests above for the protocol logic, and Task 14's e2e suite for the
  // full flow. This only covers the recipe-resolution guard, which runs before either build.
  it('throws when the recipe cannot be reconstructed from storage or the label', async () => {
    const proposal = {
      id: 'proposal-missing',
      metadata: { proposalType: 'custom' as const, rawProposalType: 'not-a-usdcx-label' },
    };
    const ms = { prepareCustomExecution: vi.fn(), submitTransaction: vi.fn() };
    const client = {} as never;

    await expect(executeCustomProposal(ms, client, proposal)).rejects.toThrow(
      /cannot reconstruct/i,
    );
    expect(ms.prepareCustomExecution).not.toHaveBeenCalled();
  });
});
