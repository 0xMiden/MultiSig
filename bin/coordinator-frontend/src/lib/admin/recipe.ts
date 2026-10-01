import { FeltArray, Poseidon2, Word } from '@miden-sdk/miden-sdk';

/**
 * The set of admin actions the USDCx admin console can propose. This is the
 * single source of truth for which actions exist; `AdminActionArgs` below
 * must stay a discriminated union over exactly these tags.
 */
export type AdminAction =
  | 'set_max_supply'
  | 'set_min_burn'
  | 'set_note_fee'
  | 'rbac_grant'
  | 'rbac_revoke'
  | 'set_attester'
  | 'pause'
  | 'unpause'
  | 'blocklist';

/**
 * Per-action argument payloads. `u64` values are carried as decimal strings
 * (never JS numbers) so they round-trip exactly through JSON and never lose
 * precision above Number.MAX_SAFE_INTEGER.
 */
export type AdminActionArgs =
  | { action: 'set_max_supply'; maxSupply: string }
  | { action: 'set_min_burn'; minBurn: string }
  | { action: 'set_note_fee'; noteFee: string }
  | { action: 'rbac_grant'; role: string; accountId: string }
  | { action: 'rbac_revoke'; role: string; accountId: string }
  | { action: 'set_attester'; attesterId: string }
  | { action: 'pause' }
  | { action: 'unpause' }
  | { action: 'blocklist'; accountId: string; blocked: boolean };

/**
 * The deterministic admin "recipe": everything needed to rebuild
 * byte-identical transaction bytes for an admin proposal. This is carried to
 * every signer via the note label (see `encodeRecipeLabel`/`decodeRecipeLabel`)
 * and persisted locally by the proposer (see `saveRecipe`/`loadRecipe`).
 *
 * `noteIdHex` is derived from the rest of the recipe (not part of the signed
 * binding) and is therefore excluded from the encoded label — see
 * `encodeRecipeLabel`.
 */
export interface AdminRecipe {
  recipeVersion: 1;
  action: AdminAction;
  senderAccountId: string;
  faucetId: string;
  feeFaucetId: string;
  networkId: string;
  actionArgs: AdminActionArgs;
  saltHex: string;
  boundBlockNum: number;
  noteIdHex?: string;
}

const LABEL_PREFIX = 'usdcx.v1.';

/**
 * Derives a deterministic serial number for an admin note from its salt,
 * via the public `@miden-sdk/miden-sdk` barrel (`Poseidon2.hashElements`).
 * This intentionally does not reuse OpenZeppelin's `deriveP2idSerialNumber`
 * (a deep, non-exported subpath import that `tsc`/webpack's exports-map
 * enforcement rejects in the production build) — the admin serial only
 * needs to be deterministic in the salt, not bit-identical to the P2ID
 * derivation, since nothing round-trips this value through the OZ SDK.
 * Deterministic in the salt: the same salt always produces the same bytes,
 * and different salts produce different bytes.
 */
export function deriveAdminSerial(saltHex: string): Uint8Array {
  return Poseidon2.hashElements(new FeltArray(Word.fromHex(saltHex).toFelts())).serialize();
}

function base64UrlEncode(input: string): string {
  const base64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(input, 'utf-8').toString('base64')
      : btoa(unescape(encodeURIComponent(input)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  else if (pad !== 0) throw new Error('Invalid base64url string');

  return typeof Buffer !== 'undefined'
    ? Buffer.from(base64, 'base64').toString('utf-8')
    : decodeURIComponent(escape(atob(base64)));
}

/**
 * Encodes a recipe into a note label of the form `usdcx.v1.<base64url>`,
 * where the payload is the JSON-serialized recipe with `noteIdHex` stripped
 * (it is derived, not part of the signed binding, and must not be fed back
 * into the recipe on decode).
 */
export function encodeRecipeLabel(r: AdminRecipe): string {
  const { noteIdHex: _omit, ...rest } = r;
  return LABEL_PREFIX + base64UrlEncode(JSON.stringify(rest));
}

/**
 * Decodes a note label produced by `encodeRecipeLabel`. Returns `null` for
 * any label that is not a `usdcx.v1.` label, or that fails to decode/parse.
 */
export function decodeRecipeLabel(label: string): AdminRecipe | null {
  if (!label.startsWith(LABEL_PREFIX)) {
    return null;
  }
  try {
    const payload = label.slice(LABEL_PREFIX.length);
    const json = base64UrlDecode(payload);
    return JSON.parse(json) as AdminRecipe;
  } catch {
    return null;
  }
}

function storageKey(proposalId: string): string {
  return `usdcxAdminRecipe:${proposalId}`;
}

/**
 * Persists a recipe to localStorage, keyed by proposal id. No-op (never
 * throws) when `window` is unavailable (SSR) or storage access fails
 * (private browsing mode, quota exceeded, etc.).
 */
export function saveRecipe(proposalId: string, r: AdminRecipe): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(proposalId), JSON.stringify(r));
  } catch {
    // Ignore storage failures (private mode, quota exceeded, etc.).
  }
}

/**
 * Loads a previously saved recipe from localStorage. Returns `null` when
 * `window` is unavailable (SSR), nothing is stored for this proposal, or
 * storage access/parsing fails for any reason.
 */
export function loadRecipe(proposalId: string): AdminRecipe | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(proposalId));
    if (raw === null) return null;
    return JSON.parse(raw) as AdminRecipe;
  } catch {
    return null;
  }
}
