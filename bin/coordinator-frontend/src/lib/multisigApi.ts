import {
  type Multisig,
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
import { MIDEN_REGISTRATION_CODE, MIDEN_RPC_URL } from '@/config/psm';

const registrationRequests = new Map<string, Promise<void>>();

/**
 * Registers a locally tracked account through the SDK. The SDK checks whether
 * the node already allows it before spending an invitation code. On devnet the
 * registration also requests the public funding note used by its first transaction.
 */
export function registerAccountOnNode(
  midenClient: MidenClient,
  accountId: string,
  invitationCode = MIDEN_REGISTRATION_CODE,
): Promise<void> {
  const key = accountId.toLowerCase();
  const existing = registrationRequests.get(key);
  if (existing) return existing;

  const request = midenClient.accounts.register({
    account: accountId,
    invitationCode,
  });

  registrationRequests.set(key, request);
  request.finally(() => registrationRequests.delete(key)).catch(() => undefined);
  return request;
}

export interface ExternalSignerParams {
  walletSource: WalletSource;
  paraContext?: { para: ParaSigningContext; walletId: string; commitment: string; publicKey: string };
  midenWalletContext?: { wallet: WalletSigningContext; commitment: string; scheme: SignatureScheme; publicKey?: string };
}

export function createSigner(
  signerInfo: SignerInfo,
  signatureScheme: SignatureScheme,
  external?: ExternalSignerParams,
): Signer {
  if (external?.walletSource === 'para' && external.paraContext) {
    const ctx = external.paraContext;
    return new ParaSigner(ctx.para, ctx.walletId, ctx.commitment, ctx.publicKey);
  }

  if (external?.walletSource === 'miden-wallet' && external.midenWalletContext) {
    const ctx = external.midenWalletContext;
    return new MidenWalletSigner(ctx.wallet, ctx.commitment, ctx.scheme, undefined, ctx.publicKey);
  }

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
 * Relays a private note's contents to its recipient via the note transport
 * service. Call this as soon as the proposal exists — before execution, not
 * after — so the block hint sendPrivate captures (the client's current sync
 * height) stays at or before the note's eventual on-chain commitment.
 */
export async function relayPrivateNote(
  midenClient: MidenClient,
  note: Note,
  recipientId: string,
  scanAfterBlockNum: number,
): Promise<void> {
  await midenClient.notes.sendPrivate({ note, to: recipientId, scanAfterBlockNum });
}

export async function registerAccountNoteTag(
  midenClient: MidenClient,
  accountId: string,
): Promise<void> {
  const id = AccountId.fromHex(accountId);
  const tag = NoteTag.withAccountTarget(id);
  await midenClient.tags.add(tag.asU32());
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
  return multisigClient.create(config, signer);
}

export async function loadMultisigAccount(
  multisigClient: MultisigClient,
  accountId: string,
  signer: Signer,
): Promise<Multisig> {
  return multisigClient.load(accountId, signer);
}
