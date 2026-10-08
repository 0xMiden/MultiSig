import {
  AccountId,
  AccountInterface,
  AccountStorageRequirements,
  Address,
  ForeignAccount,
  ForeignAccountArray,
  NetworkId,
  Note,
  NoteArray,
  TransactionRequestBuilder,
  type TransactionRequest,
} from '@miden-sdk/miden-sdk';
import { Transaction, type MidenTransaction } from '@miden-sdk/miden-wallet-adapter-base';

import { freshSaltWord } from './adminRequest';
import { buildAdminNoteBytes, initAdminWasm } from './noteBuilders';
import type { AdminAction, AdminRecipe } from './recipe';
import { ACTION_ROLE, type Role } from './roles';

/**
 * Direct admin actions: an account connected through Bread that *itself* holds a faucet role
 * (e.g. a single-sig DOM_PAUSER) runs the action from the console without a multisig proposal.
 * The console builds the same admin note the multisig path builds, wraps it in a plain
 * `TransactionRequest` with that account as sender, and hands it to Bread, which executes, proves
 * and submits it. Bread 1.16 only signs custom transactions for its *current* account, so the
 * recipe sender must be the connected address (enforced in `submitDirectAdminAction`).
 */

/** Which account an admin action is sent from, given who holds its gating role. */
export type ActionSender = 'multisig' | 'bread';

/**
 * The account id (hex, `0x` + 30 lowercase hex digits -- the form `AccountId::from_hex` in the
 * admin wasm and the SDK accept) embedded in a Bread bech32 address. Throws on a malformed address.
 *
 * Bread hands dApps its stored account identifier, which is `<address>_<routing params>` (the
 * `_qr7qqq9wr6w` suffix on a BasicWallet account). The SDK parses *some* of those suffixes but
 * throws on others ("invalid note tag length" for `_qruqqypuyph`), so the routing parameters are
 * cut off first -- the account id lives entirely in the address part, and an address without
 * routing parameters decodes to the same id. Bread canonicalizes its own ids the same way.
 */
export function accountIdHexFromBech32(address: string): string {
  const sep = address.indexOf('_');
  const idPart = sep === -1 ? address : address.slice(0, sep);
  return Address.fromBech32(idPart).accountId().toString();
}

/**
 * The faucet's bech32 address under the same network prefix as the Bread address, for the
 * custom transaction's `recipientAddress` (what Bread shows as the counterparty).
 */
export function faucetBech32ForBreadAddress(faucetIdHex: string, breadAddress: string): string {
  const sep = breadAddress.lastIndexOf('1');
  const prefix = sep > 0 ? breadAddress.slice(0, sep) : '';
  const network =
    prefix === 'mtst' ? NetworkId.testnet()
    : prefix === 'mdev' ? NetworkId.devnet()
    : prefix === 'mm' ? NetworkId.mainnet()
    : NetworkId.custom(prefix);
  return AccountId.fromHex(faucetIdHex).toBech32(network, AccountInterface.BasicWallet);
}

/**
 * Builds the complete `TransactionRequest` for a direct (single-signer) admin action: the admin
 * note as the sender's own output note, plus the faucet as a public foreign account so the fee
 * estimation FPI into `estimate_note_fee` can load it. There is no multisig auth arg and no
 * bound block (`boundBlockNum` is 0): nothing else has to rebuild these bytes later.
 *
 * `saltHex` only seeds the note serial here; a fresh salt is drawn when the recipe has none.
 */
export async function buildDirectAdminTransactionRequest(
  recipe: AdminRecipe,
): Promise<{ request: TransactionRequest; recipe: AdminRecipe }> {
  await initAdminWasm();

  const saltHex = recipe.saltHex || freshSaltWord().toHex();
  const full: AdminRecipe = { ...recipe, saltHex, boundBlockNum: 0 };

  const note = Note.deserialize(buildAdminNoteBytes(full));
  const noteIdHex = note.id().toString();

  const faucetForeign = ForeignAccount.public(AccountId.fromHex(full.faucetId), new AccountStorageRequirements());
  const request = new TransactionRequestBuilder()
    .withForeignAccounts(new ForeignAccountArray([faucetForeign]))
    .withOwnOutputNotes(new NoteArray([note]))
    .build();

  return { request, recipe: { ...full, noteIdHex } };
}

/** The minimal shape of the Bread adapter this module needs -- kept narrow so tests can mock it. */
export interface DirectActionWallet {
  /** Resolves to the submitted transaction's id (the adapter already unwraps the wallet's reply). */
  requestTransaction(transaction: MidenTransaction): Promise<string>;
}

/** The minimal shape of an already-built direct request this module needs. */
export interface BuiltDirectAdminRequest {
  request: TransactionRequest;
  recipe: AdminRecipe;
}

/**
 * Submits an already-built direct admin request through Bread and returns the transaction id.
 * Refuses a request whose sender is not the connected Bread account: Bread would reject it, but
 * only after prompting the user with a transaction that can never succeed.
 */
export async function submitDirectAdminAction(
  wallet: DirectActionWallet,
  breadAddress: string,
  built: BuiltDirectAdminRequest,
): Promise<string> {
  const connectedHex = accountIdHexFromBech32(breadAddress);
  if (connectedHex !== built.recipe.senderAccountId) {
    throw new Error(
      `This action is sent from ${built.recipe.senderAccountId}, but Bread is connected as ${connectedHex}. Switch the account in Bread and reconnect.`,
    );
  }

  const recipient = faucetBech32ForBreadAddress(built.recipe.faucetId, breadAddress);
  const tx = Transaction.createCustomTransaction(breadAddress, recipient, built.request);
  const transactionId = await wallet.requestTransaction(tx);
  if (!transactionId) throw new Error('Bread did not return a transaction id');
  return transactionId;
}

/**
 * Picks the sender for `action` from who holds its gating role: the multisig when it does (the
 * reviewed, co-signed path), else the connected Bread account when *it* does, else nobody
 * (`null`, the action stays locked). A `null` roles record means that party is absent or its
 * roles are not known yet, which never unlocks anything.
 */
export function resolveActionSender(
  action: AdminAction,
  multisigRoles: Record<Role, boolean> | null,
  breadRoles: Record<Role, boolean> | null,
): ActionSender | null {
  const role = ACTION_ROLE[action];
  if (multisigRoles?.[role]) return 'multisig';
  if (breadRoles?.[role]) return 'bread';
  return null;
}
