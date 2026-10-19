import { describe, it, expect, vi } from 'vitest';
import { executeCustomNoteProposal, runCustomExecution } from '@/lib/customNote/execute';
import { encodeRecipeLabel, type CustomNoteRecipe } from '@/lib/customNote/recipe';

const recipe: CustomNoteRecipe = {
  recipeVersion: 1, senderAccountId: '0xabc', noteHex: '0102', foreignAccountIds: [], saltHex: '0x' + '1'.repeat(64), boundBlockNum: 42,
};

describe('runCustomExecution', () => {
  it('asks for advice with the first build, then submits a fresh build with the advice folded in', async () => {
    const order: string[] = [];
    const advice = { __advice: true };
    const ms = {
      prepareCustomExecution: vi.fn(async () => { order.push('prepare'); return advice as never; }),
      submitTransaction: vi.fn(async () => { order.push('submit'); }),
    };
    const bytes = new Uint8Array([9]);
    const buildReq = vi.fn(async () => ({ request: { serialize: () => bytes } }));
    const final = { __final: true };
    const extendAdviceMap = vi.fn(() => ({ build: () => final as never }));
    const buildBuilder = vi.fn(async () => ({ builder: { extendAdviceMap } }));

    await runCustomExecution(ms, recipe, buildReq, buildBuilder, 'p1');

    expect(buildReq).toHaveBeenCalledWith(recipe);
    expect(ms.prepareCustomExecution).toHaveBeenCalledWith('p1', bytes);
    expect(buildBuilder).toHaveBeenCalledWith(recipe);
    expect(extendAdviceMap).toHaveBeenCalledWith(advice);
    expect(ms.submitTransaction).toHaveBeenCalledWith('p1', final);
    expect(order).toEqual(['prepare', 'submit']);
  });
});

describe('executeCustomNoteProposal', () => {
  const ms = { prepareCustomExecution: vi.fn(), submitTransaction: vi.fn() };

  it('refuses a custom proposal whose label is not a custom-note recipe and nothing is stored', async () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => null, setItem: () => undefined } } });
    const proposal = { id: 'p-missing', metadata: { proposalType: 'custom' as const, rawProposalType: 'usdcx_v1_abc' } };
    await expect(executeCustomNoteProposal(ms, {} as never, proposal)).rejects.toThrow(/not a custom-note proposal/i);
    expect(ms.prepareCustomExecution).not.toHaveBeenCalled();
  });

  it('resolves the recipe from the label when this browser did not propose it', async () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => null, setItem: () => undefined } } });
    const proposal = { id: 'p2', metadata: { proposalType: 'custom' as const, rawProposalType: encodeRecipeLabel(recipe) } };
    const run = vi.fn(async () => undefined);
    await executeCustomNoteProposal(ms, {} as never, proposal, run);
    expect(run).toHaveBeenCalledWith(recipe);
  });

  it('prefers the proposer\'s stored copy, which also carries the note id', async () => {
    const stored = { ...recipe, noteIdHex: '0xnote' };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (k: string) => (k === 'customNoteRecipe:p3' ? JSON.stringify(stored) : null), setItem: () => undefined } } });
    const proposal = { id: 'p3', metadata: { proposalType: 'custom' as const, rawProposalType: encodeRecipeLabel(recipe) } };
    const run = vi.fn(async () => undefined);
    await executeCustomNoteProposal(ms, {} as never, proposal, run);
    expect(run).toHaveBeenCalledWith(stored);
  });
});
