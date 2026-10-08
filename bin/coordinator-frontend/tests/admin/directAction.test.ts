import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { AccountId, AccountInterface, NetworkId, Note, TransactionRequest } from '@miden-sdk/miden-sdk';
import { initSync } from '@/lib/usdcxAdminWasm/usdcx_admin_notes';
import { __setInitializedForTests, buildAdminNoteBytes } from '@/lib/admin/noteBuilders';
import {
  accountIdHexFromBech32,
  buildDirectAdminTransactionRequest,
  faucetBech32ForBreadAddress,
  resolveActionSender,
  submitDirectAdminAction,
} from '@/lib/admin/directAction';
import type { AdminRecipe } from '@/lib/admin/recipe';
import type { Role } from '@/lib/admin/roles';

// Same proven-valid dummy ids as `tests/admin/noteBuilders.test.ts`.
const FAUCET = '0x090909080909093109090909090909';
const SENDER = '0x010101000101011101010101010101';

beforeAll(() => {
  initSync({
    module: readFileSync(new URL('../../src/lib/usdcxAdminWasm/usdcx_admin_notes_bg.wasm', import.meta.url)),
  });
  __setInitializedForTests();
});

const pauseRecipe: AdminRecipe = {
  recipeVersion: 1,
  action: 'pause',
  senderAccountId: SENDER,
  faucetId: FAUCET,
  feeFaucetId: FAUCET,
  networkId: 'testnet',
  actionArgs: { action: 'pause' },
  saltHex: '',
  boundBlockNum: 0,
};

describe('accountIdHexFromBech32', () => {
  it('round-trips an account id through its bech32 address', () => {
    const bech32 = AccountId.fromHex(SENDER).toBech32(NetworkId.testnet(), AccountInterface.BasicWallet);
    expect(bech32.startsWith('mtst1')).toBe(true);
    expect(accountIdHexFromBech32(bech32)).toBe(SENDER);
  });

  it('rejects something that is not a bech32 address', () => {
    expect(() => accountIdHexFromBech32('not-an-address')).toThrow();
  });
});

describe('faucetBech32ForBreadAddress', () => {
  it('encodes the faucet under the same network prefix as the Bread address', () => {
    const bread = AccountId.fromHex(SENDER).toBech32(NetworkId.testnet(), AccountInterface.BasicWallet);
    const faucet = faucetBech32ForBreadAddress(FAUCET, bread);
    expect(faucet.startsWith('mtst1')).toBe(true);
    expect(accountIdHexFromBech32(faucet)).toBe(FAUCET);

    const dev = AccountId.fromHex(SENDER).toBech32(NetworkId.devnet(), AccountInterface.BasicWallet);
    expect(faucetBech32ForBreadAddress(FAUCET, dev).startsWith('mdev1')).toBe(true);
  });
});

describe('buildDirectAdminTransactionRequest', () => {
  it('builds a plain request carrying the admin note as its own output note, with a fresh salt', async () => {
    const { request, recipe } = await buildDirectAdminTransactionRequest(pauseRecipe);

    expect(recipe.saltHex).toMatch(/^0x[0-9a-f]{64}$/);
    // No multisig binding on a direct transaction.
    expect(recipe.boundBlockNum).toBe(0);
    expect(recipe.senderAccountId).toBe(SENDER);

    const expectedNote = Note.deserialize(buildAdminNoteBytes(recipe));
    expect(recipe.noteIdHex).toBe(expectedNote.id().toString());

    const outputNotes = request.expectedOutputOwnNotes();
    expect(outputNotes.length).toBe(1);
    expect(outputNotes[0].id().toString()).toBe(expectedNote.id().toString());

    // Round-trips through the wire encoding Bread deserializes.
    const again = TransactionRequest.deserialize(request.serialize());
    expect(again.expectedOutputOwnNotes().length).toBe(1);
  });

  it('builds the same note for a pinned salt', async () => {
    // Only the note is pinned by the salt; the request bytes themselves are not byte-stable
    // across builds, and nothing on the direct path ever rebuilds them.
    const pinned = { ...pauseRecipe, saltHex: '0x' + '2'.repeat(64) };
    const a = await buildDirectAdminTransactionRequest(pinned);
    const b = await buildDirectAdminTransactionRequest(pinned);
    expect(a.recipe.noteIdHex).toBe(b.recipe.noteIdHex);
    expect(a.request.expectedOutputOwnNotes()[0].id().toString()).toBe(b.recipe.noteIdHex);
  });
});

describe('submitDirectAdminAction', () => {
  it('hands Bread a custom transaction from its own address carrying the serialized request', async () => {
    const bread = AccountId.fromHex(SENDER).toBech32(NetworkId.testnet(), AccountInterface.BasicWallet);
    const built = await buildDirectAdminTransactionRequest(pauseRecipe);
    const requestTransaction = vi.fn().mockResolvedValue('0xtx');

    const txId = await submitDirectAdminAction({ requestTransaction }, bread, built);

    expect(txId).toBe('0xtx');
    expect(requestTransaction).toHaveBeenCalledTimes(1);
    const [tx] = requestTransaction.mock.calls[0];
    expect(tx.type).toBe('custom');
    expect(tx.payload.address).toBe(bread);
    expect(accountIdHexFromBech32(tx.payload.recipientAddress)).toBe(FAUCET);
    expect(Buffer.from(tx.payload.transactionRequest, 'base64')).toEqual(Buffer.from(built.request.serialize()));
    expect(tx.payload.inputNoteIds).toBeUndefined();
  });

  it('refuses when the recipe sender is not the connected Bread account', async () => {
    const other = AccountId.fromHex(FAUCET).toBech32(NetworkId.testnet(), AccountInterface.BasicWallet);
    const built = await buildDirectAdminTransactionRequest(pauseRecipe);
    const requestTransaction = vi.fn();

    await expect(submitDirectAdminAction({ requestTransaction }, other, built)).rejects.toThrow(/Bread/);
    expect(requestTransaction).not.toHaveBeenCalled();
  });

  it('fails loudly when Bread returns no transaction id', async () => {
    const bread = AccountId.fromHex(SENDER).toBech32(NetworkId.testnet(), AccountInterface.BasicWallet);
    const built = await buildDirectAdminTransactionRequest(pauseRecipe);
    const requestTransaction = vi.fn().mockResolvedValue('');

    await expect(submitDirectAdminAction({ requestTransaction }, bread, built)).rejects.toThrow(/transaction id/i);
  });
});

describe('resolveActionSender', () => {
  const none: Record<Role, boolean> = {
    ADMIN: false,
    ATTEST_ADMIN: false,
    DOM_PAUSER: false,
    DOM_UNPAUSER: false,
    BLK_MANAGER: false,
  };

  it('prefers the multisig when it holds the role', () => {
    expect(resolveActionSender('pause', { ...none, DOM_PAUSER: true }, { ...none, DOM_PAUSER: true })).toBe('multisig');
    expect(resolveActionSender('pause', { ...none, DOM_PAUSER: true }, null)).toBe('multisig');
  });

  it('falls back to the Bread account when only it holds the role', () => {
    expect(resolveActionSender('pause', none, { ...none, DOM_PAUSER: true })).toBe('bread');
    expect(resolveActionSender('pause', null, { ...none, DOM_PAUSER: true })).toBe('bread');
    // The role gating pause is not the one gating unpause.
    expect(resolveActionSender('unpause', none, { ...none, DOM_PAUSER: true })).toBe(null);
  });

  it('is locked when neither holds the role or nothing is known', () => {
    expect(resolveActionSender('pause', none, none)).toBe(null);
    expect(resolveActionSender('pause', null, null)).toBe(null);
  });
});
