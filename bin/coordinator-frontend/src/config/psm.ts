import { parseMidenNetwork, type MidenNetwork } from '@/lib/midenNetwork';
import { parseParaEnvironment, type ParaEnvironment } from '@/lib/paraEnvironment';

export const GUARDIAN_ENDPOINT = process.env.NEXT_PUBLIC_GUARDIAN_ENDPOINT || '';

// Every network endpoint comes from env as a full URL: the code holds no
// devnet/testnet addresses. Missing or invalid values are collected in
// CONFIG_ERRORS and reported when the client starts.
const configErrors: string[] = [];

function endpoint(name: string, value: string | undefined, { allowLocal = false } = {}): string {
  const raw = value?.trim() ?? '';
  if (allowLocal && raw.toLowerCase() === 'local') return 'local';
  if (!raw) {
    configErrors.push(`${name} is not set.`);
    return '';
  }
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' || url.protocol === 'http:') return raw;
  } catch { /* reported below */ }
  configErrors.push(`${name} must be a full http(s) URL${allowLocal ? ' or "local"' : ''}; got "${raw}".`);
  return '';
}

// The network identity: the Miden Wallet's network, the Bech32 address prefix
// and the invitation-code rule follow it.
export const MIDEN_NETWORK: MidenNetwork = (() => {
  try {
    return parseMidenNetwork(process.env.NEXT_PUBLIC_MIDEN_NETWORK);
  } catch (error) {
    configErrors.push((error as Error).message);
    return 'custom';
  }
})();
// One concrete URL shared by the Miden, Guardian and Para clients.
export const MIDEN_RPC_URL = endpoint('NEXT_PUBLIC_MIDEN_RPC_URL', process.env.NEXT_PUBLIC_MIDEN_RPC_URL);
export const MIDEN_NOTE_TRANSPORT_URL = endpoint(
  'NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL',
  process.env.NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL,
);
// A remote prover URL, or "local" for in-browser proving (the default when
// unset). A remote prover sees the full transaction witness, including private
// note contents, so using one must be a deliberate choice. In-browser proving
// can outlast a transaction's expiration window, in which case the node
// rejects it after Guardian has already locked the account.
export const MIDEN_PROVER_URL = process.env.NEXT_PUBLIC_MIDEN_PROVER_URL?.trim()
  ? endpoint('NEXT_PUBLIC_MIDEN_PROVER_URL', process.env.NEXT_PUBLIC_MIDEN_PROVER_URL, { allowLocal: true })
  : 'local';
// Guardians a user may switch to at runtime (header > Guardian), besides the
// default one: full URLs, comma- or space-separated. Only these (and the
// default) are reachable under the page's Content-Security-Policy.
export const GUARDIAN_ENDPOINTS: readonly string[] = (() => {
  const urls = [GUARDIAN_ENDPOINT.trim()].filter(Boolean);
  for (const entry of (process.env.NEXT_PUBLIC_GUARDIAN_ENDPOINTS ?? '').split(/[\s,]+/).filter(Boolean)) {
    const url = endpoint('NEXT_PUBLIC_GUARDIAN_ENDPOINTS entry', entry);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
})();
/** Configuration problems; the app refuses to start the Miden client while any remain. */
export const CONFIG_ERRORS: readonly string[] = configErrors;
export const MIDEN_REGISTRATION_CODE = process.env.NEXT_PUBLIC_MIDEN_REGISTRATION_CODE || 'guardian';
export const MIDEN_DB_NAME = 'MidenClientDB';

// "Local keys" keep a signing key in this browser's IndexedDB, unencrypted.
// Development builds only: production signs with Ledger, Para or the Miden
// Wallet, and never falls back to a browser-held key.
export const LOCAL_KEYS_ENABLED = process.env.NODE_ENV !== 'production';

export const PARA_API_KEY = process.env.NEXT_PUBLIC_PARA_API_KEY || '';
// Must match the API key's environment: a `beta_…` key needs `beta`.
export const PARA_ENVIRONMENT: ParaEnvironment = parseParaEnvironment(process.env.NEXT_PUBLIC_PARA_ENVIRONMENT);
