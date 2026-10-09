import { FeltArray, Poseidon2, Word } from '@miden-sdk/miden-sdk';
import { profileOf, type AdminTargetKind } from '@/lib/admin/target';

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
  | 'rbac_set_admin'
  | 'rbac_renounce'
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
  | { action: 'set_note_fee'; noteScriptRoot: string; feeAmount: string }
  | { action: 'rbac_grant'; role: string; accountId: string }
  | { action: 'rbac_revoke'; role: string; accountId: string }
  | { action: 'rbac_set_admin'; role: string; adminRole: string | null }
  | { action: 'rbac_renounce'; role: string }
  | { action: 'set_attester'; commitment: string; enabled: boolean }
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
  /** The target contract id (faucet or bridge); the name predates the bridge. */
  faucetId: string;
  /** The contract kind; absent on recipes created before the AggLayer console = 'usdcx'. */
  target?: AdminTargetKind;
  feeFaucetId: string;
  networkId: string;
  actionArgs: AdminActionArgs;
  saltHex: string;
  boundBlockNum: number;
  noteIdHex?: string;
}

// The label is carried in the OpenZeppelin custom proposal's `proposalType`, which the client
// validates against `^[a-z0-9_]+$` and lowercases before storing as `rawProposalType`. So the
// prefix uses `_` separators (not `.`) and the payload is base32 over [a-z2-7] (not base64url,
// which has `-`, `_`, and case) -- every character survives both the regex and the lowercasing.
export function recipeTarget(r: Pick<AdminRecipe, 'target'>): AdminTargetKind {
  return r.target ?? 'usdcx';
}
const LABEL_PREFIXES: readonly AdminTargetKind[] = ['usdcx', 'agglayer'];

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

// RFC 4648 base32, lowercase, no padding. The alphabet is [a-z2-7], a subset of the custom
// proposal type's permitted [a-z0-9_], and lowercasing it is a no-op -- so a base32 payload passes
// the OpenZeppelin `createCustomProposal` validation and round-trips through its `toLowerCase()`.
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function utf8ToBytes(input: string): Uint8Array {
  return typeof Buffer !== 'undefined'
    ? new Uint8Array(Buffer.from(input, 'utf-8'))
    : new TextEncoder().encode(input);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return typeof Buffer !== 'undefined'
    ? Buffer.from(bytes).toString('utf-8')
    : new TextDecoder().decode(bytes);
}

function base32Encode(input: string): string {
  const bytes = utf8ToBytes(input);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function base32Decode(input: string): string {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of input) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return bytesToUtf8(new Uint8Array(out));
}

/**
 * Encodes a recipe into a note label of the form `<target prefix><base32>` (`usdcx_v1_` / `agg_v1_`),
 * where the payload is the JSON-serialized recipe with `noteIdHex` stripped
 * (it is derived, not part of the signed binding, and must not be fed back
 * into the recipe on decode).
 */
export function encodeRecipeLabel(r: AdminRecipe): string {
  const { noteIdHex: _omit, ...rest } = r;
  return profileOf(recipeTarget(r)).labelPrefix + base32Encode(JSON.stringify(rest));
}

/**
 * Decodes a note label produced by `encodeRecipeLabel`. Returns `null` for
 * any label that has neither known prefix, or that fails to decode/parse.
 */
export function decodeRecipeLabel(label: string): AdminRecipe | null {
  const kind = LABEL_PREFIXES.find((k) => label.startsWith(profileOf(k).labelPrefix));
  if (!kind) return null;
  try {
    const json = base32Decode(label.slice(profileOf(kind).labelPrefix.length));
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
