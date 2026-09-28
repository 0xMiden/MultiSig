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
export const MIDEN_REGISTRATION_CODE = process.env.NEXT_PUBLIC_MIDEN_REGISTRATION_CODE || 'guardian';
export const MIDEN_DB_NAME = 'MidenClientDB';

export const PARA_API_KEY = process.env.NEXT_PUBLIC_PARA_API_KEY || '';
export const PARA_ENVIRONMENT = (process.env.NEXT_PUBLIC_PARA_ENVIRONMENT || 'development') as
  | 'development'
  | 'production';
