import type { TypedData } from '@ledgerhq/device-signer-kit-ethereum';
import { SESSION_GRANT_SCOPE } from '@openzeppelin/miden-multisig-client';

export type LedgerPathScheme = 'ledger-live' | 'legacy';
export interface LedgerAccount {
  address: string;
  publicKey: string;
  path: string;
}
export interface LedgerDevice {
  getAddress(path: string, confirm: boolean): Promise<LedgerAccount>;
  signTypedData(path: string, data: TypedData): Promise<{ r: string; s: string; v: number }>;
  cancel(): void;
  disconnect(): Promise<void>;
}

export function ledgerPath(scheme: LedgerPathScheme, index: number): string {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 0x80000000) {
    throw new Error('Invalid Ledger account index');
  }
  return scheme === 'ledger-live' ? `44'/60'/${index}'/0/0` : `44'/60'/0'/0/${index}`;
}

export function encodeLedgerSignature({ r, s, v }: { r: string; s: string; v: number }): string {
  if (!/^0x[\da-f]{64}$/i.test(r) || !/^0x[\da-f]{64}$/i.test(s)) {
    throw new Error('Ledger returned invalid signature coordinates');
  }
  const recovery = v === 27 || v === 28 ? v - 27 : v;
  if (recovery !== 0 && recovery !== 1) throw new Error('Ledger returned an invalid recovery ID');
  return `${r}${s.slice(2)}${recovery.toString(16).padStart(2, '0')}`;
}

const domainTypes = [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }];
const SESSION_DOMAIN = 'Guardian Session';
// Guardian 0.18.1 session messages (multisig client `utils/eip712.js`): every
// field is shown on the device, so each one is checked here.
const SESSION_TYPES: Record<string, Array<{ name: string; type: string }>> = {
  GuardianSession: [
    { name: 'signer', type: 'bytes32' },
    { name: 'sessionKey', type: 'bytes' },
    { name: 'origin', type: 'string' },
    { name: 'issuedAt', type: 'uint64' },
    { name: 'expiresAt', type: 'uint64' },
    { name: 'expires', type: 'string' },
    { name: 'scope', type: 'string' },
    { name: 'guardianKey', type: 'bytes32' },
    { name: 'network', type: 'string' },
  ],
  GuardianSessionRevokeAll: [
    { name: 'signer', type: 'bytes32' },
    { name: 'timestamp', type: 'uint64' },
  ],
};
/** Guardian's longest session (`GUARDIAN_SESSION_MAX_TTL_SECONDS` may only shorten it). */
const MAX_SESSION_SECONDS = 28_800;
const WORD = /^0x[\da-f]{64}$/i;
const UINT = /^\d{1,20}$/;
/** How far a grant's start or a revoke-all's time may be from this device's clock. */
const SESSION_SKEW_SECONDS = 60;

/** `YYYY-MM-DD HH:MM:SS UTC`, as the multisig client writes a grant's readable expiry. */
function utcSeconds(unixSeconds: number): string {
  const iso = new Date(unixSeconds * 1000).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}

const sameWord = (a: string, b: string) => a.replace(/^0x/i, '').toLowerCase() === b.replace(/^0x/i, '').toLowerCase();

export interface SessionMessageContext {
  /** The page's origin: a grant must name it. */
  origin: string;
  /** This Ledger's signer commitment: a session message must be for it. */
  signer: string | null;
  /** Now, in ms. */
  now: number;
}

function checkSessionMessage(primaryType: string, message: Record<string, unknown>, context: SessionMessageContext): void {
  const fields = SESSION_TYPES[primaryType].map((field) => field.name);
  const ok = (condition: boolean) => { if (!condition) throw new Error('Ledger session message does not match the supported protocol schema'); };
  ok(Object.keys(message).length === fields.length && fields.every((field) => typeof message[field] === 'string'));
  const m = message as Record<string, string>;
  // Only for this Ledger's own key: an adapter not bound to it signs no session message.
  ok(WORD.test(m.signer) && context.signer !== null && sameWord(m.signer, context.signer));
  const nowSeconds = Math.floor(context.now / 1000);
  if (primaryType === 'GuardianSessionRevokeAll') {
    ok(UINT.test(m.timestamp) && Math.abs(Number(m.timestamp) - context.now) <= SESSION_SKEW_SECONDS * 1000);
    return;
  }
  const issuedAt = Number(m.issuedAt);
  const expiresAt = Number(m.expiresAt);
  ok(/^0x0[23][\da-f]{64}$/i.test(m.sessionKey));
  // A grant for another website would let that site act for this wallet.
  ok(Boolean(context.origin) && m.origin === context.origin);
  ok(UINT.test(m.issuedAt) && UINT.test(m.expiresAt) && expiresAt > issuedAt && expiresAt - issuedAt <= MAX_SESSION_SECONDS);
  // Starting now: a post-dated grant could be registered later, after a logout
  // or a revoke-all, and outlive both.
  ok(Math.abs(issuedAt - nowSeconds) <= SESSION_SKEW_SECONDS);
  // The readable expiry the device shows must be the real one.
  ok(m.expires === utcSeconds(expiresAt));
  ok(m.scope === SESSION_GRANT_SCOPE);
  ok(WORD.test(m.guardianKey));
  ok(/^[a-z0-9-]{1,32}$/i.test(m.network));
}

// Only the protocol-defined messages used by our signer may reach this adapter.
export function parseLedgerTypedData(value: unknown, context: Partial<SessionMessageContext> = {}): TypedData {
  if (typeof value !== 'string') throw new Error('Expected serialized typed data');
  const data = JSON.parse(value) as TypedData;
  if (data && Object.hasOwn(SESSION_TYPES, data.primaryType)) {
    const types = { EIP712Domain: domainTypes, [data.primaryType]: SESSION_TYPES[data.primaryType] };
    if (data.domain?.name !== SESSION_DOMAIN || data.domain.version !== '1' || Object.keys(data.domain).length !== 2 ||
        JSON.stringify(data.types) !== JSON.stringify(types) || !data.message || typeof data.message !== 'object') {
      throw new Error('Ledger typed data does not match the supported protocol schema');
    }
    checkSessionMessage(data.primaryType, data.message as Record<string, unknown>, {
      origin: context.origin ?? globalThis.location?.origin ?? '',
      signer: context.signer ?? null,
      now: context.now ?? Date.now(),
    });
    return data;
  }
  const definitions: Record<string, [string, string]> = {
    MidenTransaction: ['Miden Transaction', 'txSummaryHash'],
    GuardianRequest: ['Guardian Request', 'requestHash'],
    GuardianLookup: ['Guardian Lookup', 'lookupHash'],
  };
  const definition = data && Object.hasOwn(definitions, data.primaryType) ? definitions[data.primaryType] : undefined;
  if (!definition) throw new Error('Unsupported Ledger signing message');
  const [name, field] = definition;
  const types = {
    EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }],
    [data.primaryType]: [{ name: field, type: 'bytes32' }],
  };
  if (data.domain?.name !== name || data.domain.version !== '1' ||
      Object.keys(data.domain).length !== 2 ||
      JSON.stringify(data.types) !== JSON.stringify(types) ||
      !data.message || Object.keys(data.message).length !== 1 ||
      typeof data.message[field] !== 'string' || !/^0x[\da-f]{64}$/i.test(data.message[field] as string)) {
    throw new Error('Ledger typed data does not match the supported protocol schema');
  }
  return data;
}

const PROMPTS: Record<string, string> = {
  MidenTransaction: 'Approve the transaction summary on Ledger',
  GuardianLookup: 'Approve account lookup on Ledger',
  GuardianSession: 'Approve the Guardian session on Ledger: one approval instead of one per Guardian request',
  GuardianSessionRevokeAll: 'Approve ending all Guardian sessions on Ledger',
};

/** A session-bound EIP-1193 bridge; no Ledger Wallet Provider or remote API key. */
export class DirectLedgerAdapter {
  private tail: Promise<unknown> = Promise.resolve();
  private valid = true;
  /** This Ledger's signer commitment, once known: session messages must be for it. */
  private signer: string | null = null;

  readonly account: Readonly<LedgerAccount>;

  constructor(
    private readonly device: LedgerDevice,
    account: LedgerAccount,
    private readonly onPrompt: (message: string | null) => void = () => {},
  ) { this.account = Object.freeze({ ...account }); }

  invalidate(): void {
    this.valid = false;
    this.device.cancel();
  }

  /** Binds the signer commitment derived from this Ledger's key (see useLedgerSession). */
  bindSigner(commitment: string): void {
    this.signer = commitment;
  }

  async request({ method, params }: { method: string; params: unknown[] }): Promise<string> {
    if (!this.valid) throw new Error('Ledger session changed. Reconnect and load the account again.');
    if (method !== 'eth_signTypedData_v4') throw new Error(`Unsupported Ledger method: ${method}`);
    if (typeof params[0] !== 'string' || params[0].toLowerCase() !== this.account.address.toLowerCase()) {
      throw new Error('Signing address does not match the selected Ledger account');
    }
    const data = parseLedgerTypedData(params[1], { signer: this.signer });
    const queuedAt = Date.now();
    const operation = this.tail.then(async () => {
      if (!this.valid) throw new Error('Ledger session changed. Load the account again.');
      // Request authentication timestamps were created before queueing. Never sign stale requests.
      if (data.primaryType !== 'MidenTransaction' && Date.now() - queuedAt > 30_000) {
        throw new Error('Ledger authentication waited too long. Please retry the action.');
      }
      this.onPrompt(PROMPTS[data.primaryType] ?? 'Authenticate the Guardian request on Ledger');
      try {
        const signature = await this.device.signTypedData(this.account.path, data);
        if (!this.valid) throw new Error('Ledger session changed during signing');
        return encodeLedgerSignature(signature);
      } finally {
        this.onPrompt(null);
      }
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
