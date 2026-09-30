export const GUARDIAN_ENDPOINT = process.env.NEXT_PUBLIC_GUARDIAN_ENDPOINT || '';
// Guardian's raw WASM client does not resolve SDK network shorthands.
// Share a concrete URL across Miden, Guardian, and Para clients.
const rpcEndpoints: Record<string, string> = {
  devnet: 'https://rpc.devnet.miden.io',
  testnet: 'https://rpc.testnet.miden.io',
  local: 'http://localhost:57291',
  localhost: 'http://localhost:57291',
};
const configuredRpc = process.env.NEXT_PUBLIC_MIDEN_RPC_URL?.trim() || 'devnet';
export const MIDEN_RPC_URL = rpcEndpoints[configuredRpc.toLowerCase()] ?? configuredRpc;
export const MIDEN_NOTE_TRANSPORT_URL = process.env.NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL || 'devnet';
// Unset keeps in-browser proving: a remote prover sees the full transaction
// witness, including private note contents, so using one must be a deliberate
// choice. In-browser proving can outlast a transaction's expiration window, in
// which case the node rejects it after Guardian has already locked the account.
export const MIDEN_PROVER_URL = process.env.NEXT_PUBLIC_MIDEN_PROVER_URL?.trim() || 'local';
export const MIDEN_REGISTRATION_CODE = process.env.NEXT_PUBLIC_MIDEN_REGISTRATION_CODE || 'guardian';
export const MIDEN_DB_NAME = 'MidenClientDB';

// "Local keys" keep a signing key in this browser's IndexedDB, unencrypted.
// Development builds only: production signs with Ledger, Para or the Miden
// Wallet, and never falls back to a browser-held key.
export const LOCAL_KEYS_ENABLED = process.env.NODE_ENV !== 'production';

export const PARA_API_KEY = process.env.NEXT_PUBLIC_PARA_API_KEY || '';
export const PARA_ENVIRONMENT = (process.env.NEXT_PUBLIC_PARA_ENVIRONMENT || 'development') as
  | 'development'
  | 'production';
