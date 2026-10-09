import {
  Multisig,
  AccountInspector,
  type MultisigClient,
  type MultisigConfig,
  type ProcedureThreshold,
  type ParaSigningContext,
  type WalletSigningContext,
  MultisigClient as MultisigClientClass,
  FalconSigner,
  EcdsaSigner,
  ParaSigner,
  MidenWalletSigner,
  type SignatureScheme,
} from '@openzeppelin/miden-multisig-client';
import type { Signer } from '@openzeppelin/guardian-client';
import {
  AccountId,
  Endpoint,
  NoteTag,
  NoteType,
  RpcClient,
  TransactionSummary,
  type Note,
  type NoteId,
  type NoteInclusionProof,
  type MidenClient,
} from '@miden-sdk/miden-sdk';
import type { SignerInfo } from '@/types/psm';
import type { WalletSource } from '@/wallets/types';
import { normalizeCommitment } from '@/lib/helpers';
import { LOCAL_KEYS_ENABLED, MIDEN_NETWORK, MIDEN_REGISTRATION_CODE, MIDEN_RPC_URL } from '@/config/psm';
import { diagnosticError, diagnosticLog, instrumentMultisig } from './midenDiagnostics';
import { registerNodeAccount } from './nodeRegistration';
import { registrationInvitationCode } from './midenNetwork';
import { configureProverWorkflow } from './proverFallback';
import { markExecutionPushed } from './pendingCandidate';
import { retryProposalSubmission } from './proposalSubmission';
import { toast } from 'sonner';

const registrationRequests = new Map<string, Promise<void>>();

/**
 * Registers a new account with the Miden node, on every network. The direct
 * RPC (nodeRegistration.ts) is used because the SDK's own path skips the call
 * when the node already allows the account. Registration funds a new account
 * (devnet and testnet). The invitation code is the one the creator confirmed on
 * the create page, else the network default (see defaultInvitationCode).
 */
export function registerAccountOnNode(
  midenClient: MidenClient,
  accountId: string,
  userInvitationCode?: string,
): Promise<void> {
  const key = `${MIDEN_RPC_URL}:${accountId.toLowerCase()}`;
  const existing = registrationRequests.get(key);
  if (existing) return existing;

  let code: string;
  try {
    code = registrationInvitationCode(MIDEN_NETWORK, MIDEN_REGISTRATION_CODE, userInvitationCode);
  } catch (error) {
    return Promise.reject(error);
  }
  const request = (async () => {
    diagnosticLog('registration.START', { accountId, network: MIDEN_NETWORK, withInvitation: Boolean(code) });
    try {
      await registerNodeAccount(MIDEN_RPC_URL, accountId, code, (identity) => {
        diagnosticLog('registration.NETWORK_IDENTITY', { accountId, ...identity });
      });
      diagnosticLog('registration.OK', { accountId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const duplicate = /\bALREADY_REGISTERED\b|\balready registered\b/i.test(message);
      const allowed = /\bACCOUNT_ALREADY_ALLOWED\b|\balready allowed on the network\b/i.test(message);
      // Already registered is fine once the node confirms it accepts the
      // account; never swallow unrelated failures.
      if ((duplicate || allowed) && await midenClient.accounts.isAllowed(accountId)) {
        diagnosticLog('registration.ALREADY_ALLOWED', { accountId });
        return;
      }
      diagnosticLog('registration.FAIL', { accountId, error: diagnosticError(error) });
      throw error;
    }
  })();

  registrationRequests.set(key, request);
  request.finally(() => registrationRequests.delete(key)).catch(() => undefined);
  return request;
}

export interface ExternalSignerParams {
  walletSource: WalletSource;
  ledgerSigner?: Signer;
  paraContext?: { para: ParaSigningContext; walletId: string; commitment: string; publicKey: string };
  midenWalletContext?: { wallet: WalletSigningContext; commitment: string; scheme: SignatureScheme; publicKey?: string };
}

export function createSigner(
  signerInfo: SignerInfo | null,
  signatureScheme: SignatureScheme,
  external?: ExternalSignerParams,
): Signer {
  if (external?.walletSource === 'ledger') {
    if (!external.ledgerSigner) throw new Error('Connect and select a Ledger account first');
    if (signatureScheme !== 'ecdsa') throw new Error('Ledger requires an ECDSA multisig account');
    return external.ledgerSigner;
  }
  if (external?.walletSource === 'para' && external.paraContext) {
    const ctx = external.paraContext;
    return new ParaSigner(ctx.para, ctx.walletId, ctx.commitment, ctx.publicKey);
  }

  if (external?.walletSource === 'miden-wallet' && external.midenWalletContext) {
    const ctx = external.midenWalletContext;
    return new MidenWalletSigner(ctx.wallet, ctx.commitment, ctx.scheme, undefined, ctx.publicKey);
  }

  // Only the explicit "local keys" source reaches this point; every external
  // source either returned above or was refused by the caller.
  if (!LOCAL_KEYS_ENABLED) {
    throw new Error('Connect a wallet (Ledger, Para or the Miden Wallet) first.');
  }
  if (!signerInfo) throw new Error('Local keys are still being generated. Try again in a moment.');
  const activeSigner = signatureScheme === 'ecdsa' ? signerInfo.ecdsa : signerInfo.falcon;
  return signatureScheme === 'ecdsa'
    ? new EcdsaSigner(activeSigner.secretKey)
    : new FalconSigner(activeSigner.secretKey);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Extracts the full output notes a proposal's transaction will create, by
 * deserializing its own `txSummary` — no Guardian call, no chain sync, no
 * ambiguity between proposals. Same reconstruction `verifyProposalMetadataBinding`
 * already runs internally on every syncProposals().
 *
 * Returns full `Note` objects, not just IDs: sendPrivate() only skips its
 * local-database lookup when given an object with real `.id()`/`.assets()`
 * methods (checked via duck typing in the SDK's own sendPrivate wrapper). A
 * plain ID string or NoteId falls through to that lookup instead — which
 * fails here, because the note hasn't been executed yet, so it was never
 * written to the local database in the first place.
 */
export function getOutputNotesFromTxSummary(txSummaryBase64: string): Note[] {
  const summary = TransactionSummary.deserialize(base64ToBytes(txSummaryBase64));
  return summary
    .outputNotes()
    .notes()
    .map((note) => note.intoFull())
    .filter(
      (note): note is Note =>
        note !== undefined && note.metadata().noteType() === NoteType.Private,
    );
}

/**
 * The inclusion proof of a committed note, read from the node; undefined
 * while the note is not committed yet. Works for any cosigner, not only the
 * one whose client executed the transaction.
 */
export async function fetchNoteInclusionProof(
  noteId: NoteId,
  rpcUrl: string = MIDEN_RPC_URL,
): Promise<NoteInclusionProof | undefined> {
  const rpc = new RpcClient(new Endpoint(rpcUrl));
  try {
    const [fetched] = await rpc.getNotesById([noteId]);
    return fetched?.inclusionProof;
  } finally {
    rpc.free();
  }
}

export async function registerAccountNoteTag(
  midenClient: MidenClient,
  accountId: string,
): Promise<void> {
  const id = AccountId.fromHex(accountId);
  const tag = NoteTag.withAccountTarget(id);
  await midenClient.tags.add(tag.asU32());
}

/**
 * Wires each multisig for the app: sync before executing with a local-proving
 * fallback (proverFallback.ts), and re-submission of a built proposal when the
 * Guardian push fails transiently (proposalSubmission.ts).
 */
function prepareMultisig(multisig: Multisig): Multisig {
  retryProposalSubmission(multisig, {
    onRetry(attempt, error) {
      console.warn(`Guardian did not accept the proposal (attempt ${attempt}); retrying with the same data.`, error);
    },
  });
  configureProverWorkflow(multisig, {
    onPushed() {
      markExecutionPushed(multisig.accountId);
    },
    onFallback(error) {
      console.warn('Remote prover failed; proving on this device instead.', error);
      toast.info('The remote prover did not respond, so this transaction is being proved on this device. This can take a minute or two; keep this tab open.');
    },
  });
  return multisig;
}

export async function initMultisigClient(
  midenClient: MidenClient,
  guardianEndpoint: string,
  scheme?: SignatureScheme,
): Promise<{ client: MultisigClient; guardianCommitment: string; guardianPubkey?: string }> {
  const client = new MultisigClientClass(midenClient, {
    guardianEndpoint,
    midenRpcEndpoint: MIDEN_RPC_URL,
  });
  const pubkeyResp = await client.guardianClient.getPubkey(scheme);
  return { client, guardianCommitment: pubkeyResp.commitment, guardianPubkey: pubkeyResp.pubkey };
}

export async function createMultisigAccount(
  multisigClient: MultisigClient,
  signerCommitment: string,
  otherCommitments: string[],
  threshold: number,
  guardianCommitment: string,
  signer: Signer,
  guardianPublicKey?: string,
  procedureThresholds?: ProcedureThreshold[],
  signatureScheme: SignatureScheme = 'falcon',
): Promise<Multisig> {
  const signerCommitments = [signerCommitment, ...otherCommitments].map(normalizeCommitment);
  const config: MultisigConfig = {
    threshold,
    signerCommitments,
    guardianCommitment,
    guardianPublicKey,
    procedureThresholds,
    storageMode: 'private',
    signatureScheme,
  };
  const multisig = await multisigClient.create(config, signer);
  instrumentMultisig(multisig, multisigClient);
  return prepareMultisig(multisig);
}

export async function loadMultisigAccount(
  multisigClient: MultisigClient,
  accountId: string,
  signer: Signer,
): Promise<Multisig> {
  const multisig = await multisigClient.load(accountId, signer);
  instrumentMultisig(multisig, multisigClient);
  return prepareMultisig(multisig);
}

/** Restore an unused local account after Guardian registration was interrupted. */
export async function loadPendingMultisigAccount(
  multisigClient: MultisigClient,
  midenClient: MidenClient,
  accountId: string,
  signer: Signer,
): Promise<Multisig> {
  const account = await midenClient.accounts.get(accountId);
  if (!account || account.nonce().asInt() !== 0n) {
    throw new Error('No unused local account is available for Guardian registration recovery');
  }
  const signerCommitments = AccountInspector.getSignerPublicKeyCommitments(account);
  if (!signerCommitments.map(normalizeCommitment).includes(normalizeCommitment(signer.commitment))) {
    throw new Error('The selected signer is not authorized for this local account');
  }
  const guardianCommitment = AccountInspector.getGuardianPublicKeyCommitment(account);
  const guardian = multisigClient.guardianClient;
  const pubkey = await guardian.getPubkey(signer.scheme);
  if (normalizeCommitment(pubkey.commitment) !== normalizeCommitment(guardianCommitment)) {
    throw new Error('The local account belongs to a different Guardian');
  }
  const detected = AccountInspector.fromAccount(account);
  const config: MultisigConfig = {
    threshold: detected.threshold,
    signerCommitments,
    guardianCommitment,
    guardianPublicKey: pubkey.pubkey,
    signatureScheme: signer.scheme,
    procedureThresholds: Array.from(detected.procedureThresholds, ([procedure, threshold]) => ({ procedure, threshold })),
  };
  guardian.setSigner(signer);
  const multisig = new Multisig(account, config, guardian, signer, midenClient, accountId, MIDEN_RPC_URL);
  instrumentMultisig(multisig, multisigClient);
  return prepareMultisig(multisig);
}
