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
  NoteTag,
  NoteType,
  TransactionSummary,
  type Note,
  type MidenClient,
} from '@miden-sdk/miden-sdk';
import type { SignerInfo } from '@/types/psm';
import type { WalletSource } from '@/wallets/types';
import { normalizeCommitment } from '@/lib/helpers';
import { LOCAL_KEYS_ENABLED, MIDEN_REGISTRATION_CODE, MIDEN_RPC_URL } from '@/config/psm';
import { diagnosticError, diagnosticLog, instrumentMultisig } from './midenDiagnostics';
import { registerDevnetAccount } from './devnetRegistration';
import { configureProverWorkflow } from './proverFallback';
import { markExecutionPushed } from './pendingCandidate';
import { retryProposalSubmission } from './proposalSubmission';
import { toast } from 'sonner';

const registrationRequests = new Map<string, Promise<void>>();

/**
 * Devnet funding requires the direct RPC: the high-level SDK short-circuits
 * when the network allows every account, without requesting a funding note.
 */
export function registerAccountOnNode(
  midenClient: MidenClient,
  accountId: string,
  invitationCode = MIDEN_REGISTRATION_CODE,
): Promise<void> {
  const key = `${MIDEN_RPC_URL}:${accountId.toLowerCase()}`;
  const existing = registrationRequests.get(key);
  if (existing) return existing;

  const request = (async () => {
    const devnet = /^https:\/\/rpc\.devnet\.miden\.io(?::443)?\/?$/.test(MIDEN_RPC_URL);
    diagnosticLog('registration.START', { accountId, mode: devnet ? 'devnet-direct-rpc' : 'sdk' });
    try {
      if (devnet) {
        await registerDevnetAccount(accountId, invitationCode, (identity) => {
          diagnosticLog('registration.NETWORK_IDENTITY', { accountId, ...identity });
        });
      } else if (!(await midenClient.accounts.isAllowed(accountId))) {
        await midenClient.accounts.register({ account: accountId, invitationCode });
      }
      diagnosticLog('registration.OK', { accountId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const duplicate = /\bALREADY_REGISTERED\b|\balready registered\b/i.test(message);
      const allowed = /\bACCOUNT_ALREADY_ALLOWED\b|\balready allowed on the network\b/i.test(message);
      // Confirm the node accepts this account; never swallow unrelated failures.
      if ((duplicate || (!devnet && allowed)) && await midenClient.accounts.isAllowed(accountId)) {
        diagnosticLog('registration.ALREADY_ALLOWED', { accountId, fundingConfirmed: false });
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
 * The ids of the private notes a proposal will create, from the proposal's own
 * transaction summary. Run this BEFORE executing: it throws if the summary
 * holds no private note, because executing then would commit a note nobody
 * can reconstruct.
 */
export function privateNoteIdsToDeliver(
  txSummaryBase64: string,
  extractNotes: (txSummaryBase64: string) => Note[] = getOutputNotesFromTxSummary,
): string[] {
  const notes = extractNotes(txSummaryBase64);
  if (notes.length === 0) {
    throw new Error('This private send has no private note to deliver, so it cannot be executed safely.');
  }
  return notes.map((note) => note.id().toString());
}

/** How long {@link relayProposalNotes} keeps trying to deliver a note. */
export interface RelayRetry {
  attempts: number;
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_RELAY_RETRY: RelayRetry = { attempts: 20, delayMs: 3000 };

/**
 * Delivers a proposal's private output notes to their recipient through the
 * note transport. Run this AFTER executing: the transport only accepts a note
 * together with its inclusion proof, and the proof exists only once the
 * creating transaction is committed and this client has synced past its block.
 * So each attempt syncs first, then relays whatever is still undelivered.
 * Throws if a note is still undelivered when the attempts run out.
 */
export async function relayProposalNotes(
  midenClient: MidenClient,
  noteIds: string[],
  recipientId: string,
  retry: RelayRetry = DEFAULT_RELAY_RETRY,
): Promise<number> {
  const sleep = retry.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let pending = noteIds;
  let lastError: unknown;
  for (let attempt = 1; attempt <= retry.attempts; attempt++) {
    try {
      await midenClient.sync();
    } catch (err) {
      lastError = err;
    }
    const undelivered: string[] = [];
    for (const noteId of pending) {
      try {
        await midenClient.notes.sendPrivateOutput({ noteId, to: recipientId });
      } catch (err) {
        lastError = err;
        undelivered.push(noteId);
      }
    }
    pending = undelivered;
    if (pending.length === 0) return noteIds.length;
    if (attempt < retry.attempts) await sleep(retry.delayMs);
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `${pending.length} of ${noteIds.length} private note(s) could not be delivered after ${retry.attempts} attempts: ${reason}`,
  );
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
