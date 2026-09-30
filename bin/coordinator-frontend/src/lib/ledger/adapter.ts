import type { TypedData } from '@ledgerhq/device-signer-kit-ethereum';

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

// Only the protocol-defined messages used by our signer may reach this adapter.
export function parseLedgerTypedData(value: unknown): TypedData {
  if (typeof value !== 'string') throw new Error('Expected serialized typed data');
  const data = JSON.parse(value) as TypedData;
  const definitions: Record<string, [string, string]> = {
    MidenTransaction: ['Miden Transaction', 'txSummaryHash'],
    GuardianRequest: ['Guardian Request', 'requestHash'],
    GuardianLookup: ['Guardian Lookup', 'lookupHash'],
  };
  const definition = definitions[data?.primaryType];
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

/** A session-bound EIP-1193 bridge; no Ledger Wallet Provider or remote API key. */
export class DirectLedgerAdapter {
  private tail: Promise<unknown> = Promise.resolve();
  private valid = true;

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

  async request({ method, params }: { method: string; params: unknown[] }): Promise<string> {
    if (!this.valid) throw new Error('Ledger session changed. Reconnect and load the account again.');
    if (method !== 'eth_signTypedData_v4') throw new Error(`Unsupported Ledger method: ${method}`);
    if (typeof params[0] !== 'string' || params[0].toLowerCase() !== this.account.address.toLowerCase()) {
      throw new Error('Signing address does not match the selected Ledger account');
    }
    const data = parseLedgerTypedData(params[1]);
    const queuedAt = Date.now();
    const operation = this.tail.then(async () => {
      if (!this.valid) throw new Error('Ledger session changed. Load the account again.');
      // Request authentication timestamps were created before queueing. Never sign stale requests.
      if (data.primaryType !== 'MidenTransaction' && Date.now() - queuedAt > 30_000) {
        throw new Error('Ledger authentication waited too long. Please retry the action.');
      }
      this.onPrompt(data.primaryType === 'MidenTransaction'
        ? 'Approve the transaction summary on Ledger'
        : data.primaryType === 'GuardianLookup'
          ? 'Approve account lookup on Ledger'
          : 'Authenticate the Guardian request on Ledger');
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
