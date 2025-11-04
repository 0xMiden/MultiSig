// Hook-related types

// Wallet Data Hook Types
export interface WalletFormData {
  walletName: string;
  signatureThreshold: string;
  totalSigners: string;
  network: string;
  signerAddresses: string[];
  signerPublicKeys: string[];
}

export interface WalletData {
  approver_number: number;
  kind: string;
  threshold: number;
  approver: string[];
  // Form data from localStorage
  walletFormData?: WalletFormData;
}

// Fungible Assets Hook Types
export interface FungibleAsset {
  faucetId: string;
  balance: string;
}

// Miden SDK Types
export interface MidenClient {
  create_wallet: (storageMode: StorageMode) => Promise<MidenWallet>;
  get_accounts: () => Promise<MidenAccount[]>;
  sync: () => Promise<void>;
  new_transaction: (accountId: string, transactionType: string) => Promise<MidenTransaction>;
}

export interface MidenWallet {
  account_id: string;
  address: string;
}

export interface MidenAccount {
  id: string;
  address: string;
}

export interface MidenTransaction {
  id: string;
  to_bytes: () => Uint8Array;
}

export interface StorageMode {
  type: 'memory' | 'sqlite';
  path?: string;
}

export interface MidenFaucet {
  account_id: string;
  asset_id: string;
}

// WebClient types from miden-sdk
export interface WebClient {
  syncState: () => Promise<void>;
  getInputNote: (noteId: string) => Promise<InputNoteRecord | undefined>;
  importNoteFile: (noteBytes: Uint8Array) => Promise<void>;
  consumeNotes: (noteIds: string[], accountId: string) => Promise<void>;
  getInputNotes: (status?: string) => Promise<InputNoteRecord[]>;
  newTransaction: (accountId: string, transactionType: string) => Promise<TransactionTemplate>;
}

export interface InputNoteRecord {
  note_id: string;
  assets: NoteAsset[];
  status: string;
  inclusion_proof?: string;
}

export interface NoteAsset {
  asset_type: string;
  faucet_id?: string;
  amount: bigint;
}

export interface TransactionTemplate {
  add_input_note: (noteId: string) => void;
  send_asset: (assetId: string, amount: bigint, senderAccountId: string, recipientAddress: string, recallHeight: bigint) => void;
  build: () => Promise<Uint8Array>;
}

// Extend Uint8Array to include base64 methods that exist in the Miden SDK
export interface Uint8ArrayConstructor {
  fromBase64(base64: string): Uint8Array;
}

export interface Uint8ArrayWithBase64 extends Uint8Array {
  toBase64(): string;
}

// Miden SDK Hook Types
export interface MidenSdkContextState {
  isLoading: boolean;
  Miden: typeof MidenSDK | null;
  createClient: () => Promise<MidenClient>;
  createFaucet: (
    client: MidenClient,
    storageMode: StorageMode,
    nonFungible: boolean,
    assetSymbol: string,
    decimals: number,
    totalSupply: bigint
  ) => Promise<MidenFaucet>;
}

// Miden SDK class type
export interface MidenSDK {
  Client: {
    new(config: unknown): MidenClient;
  };
  StorageMode: {
    Memory: () => StorageMode;
    Sqlite: (path: string) => StorageMode;
  };
}

export interface MidenSdkProviderProps {
  children: React.ReactNode;
}
