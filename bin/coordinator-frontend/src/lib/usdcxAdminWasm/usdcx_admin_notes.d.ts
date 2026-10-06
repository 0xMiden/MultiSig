/* tslint:disable */
/* eslint-disable */

/**
 * Returns whether `account_hex` holds `role` on the faucet, given the faucet's
 * serialized `Account` bytes (fetch via `@miden-sdk` `client.getAccount(faucetId)`
 * then `.serialize()`). Used to gate the admin dropdown.
 */
export function account_has_role(faucet_account: Uint8Array, account_hex: string, role: string): boolean;

/**
 * Build a `block` (`unblock = false`) or `unblock` (`unblock = true`) note.
 */
export function build_blocklist(faucet_hex: string, sender_hex: string, account_hex: string, unblock: boolean, serial: Uint8Array): Uint8Array;

/**
 * Build a `pause` (`unpause = false`) or `unpause` (`unpause = true`) note.
 */
export function build_pause(faucet_hex: string, sender_hex: string, unpause: boolean, serial: Uint8Array): Uint8Array;

/**
 * Build an RBAC grant note.
 */
export function build_rbac_grant(faucet_hex: string, sender_hex: string, role: string, account_hex: string, serial: Uint8Array): Uint8Array;

/**
 * Build an RBAC revoke note.
 */
export function build_rbac_revoke(faucet_hex: string, sender_hex: string, role: string, account_hex: string, serial: Uint8Array): Uint8Array;

/**
 * Build a `set_attester` note (faucet-owned). `commitment` is serialized `Word` bytes.
 */
export function build_set_attester(faucet_hex: string, sender_hex: string, commitment: Uint8Array, enabled: boolean, serial: Uint8Array): Uint8Array;

/**
 * Build a `set_max_supply` note. Returns serialized `Note` bytes.
 */
export function build_set_max_supply(faucet_hex: string, sender_hex: string, max_supply: bigint, serial: Uint8Array): Uint8Array;

/**
 * Build a `set_min_burn_amount` note (faucet-owned; floor >= 1).
 */
export function build_set_min_burn(faucet_hex: string, sender_hex: string, min_burn: bigint, serial: Uint8Array): Uint8Array;

/**
 * Build a `set_note_fee` note repricing `note_script_root` to `fee_amount` of
 * the `fee_faucet` asset. `note_script_root` is serialized `NoteScriptRoot` bytes.
 */
export function build_set_note_fee(faucet_hex: string, sender_hex: string, note_script_root: Uint8Array, fee_faucet_hex: string, fee_amount: bigint, serial: Uint8Array): Uint8Array;

/**
 * The faucet's current maximum issuable supply (base units), from its serialized `Account` bytes.
 */
export function current_max_supply(faucet_account: Uint8Array): bigint;

/**
 * The faucet's current minimum burn amount (base units), from its serialized `Account` bytes.
 */
export function current_min_burn(faucet_account: Uint8Array): bigint;

/**
 * The faucet's current token supply (base units already issued), from its serialized `Account`
 * bytes. This is the floor a new max supply must not drop below.
 */
export function current_token_supply(faucet_account: Uint8Array): bigint;

/**
 * The current fee (base units) scheduled for `note_script_root`, or `undefined` when no explicit
 * fee is set for that script. Script root crosses as serialized `NoteScriptRoot` bytes.
 */
export function note_fee(faucet_account: Uint8Array, note_script_root: Uint8Array): bigint | undefined;

/**
 * Returns the hex account ids of every current holder of `role` on the faucet, given the
 * faucet's serialized `Account` bytes (same fetch path as [`account_has_role`]). Used to drive
 * the frontend's mandatory "last-ADMIN" guardrail, which `account_has_role`'s one-account-at-a-
 * time boolean cannot support.
 */
export function rbac_role_members(faucet_account: Uint8Array, role: string): string[];

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly account_has_role: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly build_blocklist: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number, number];
  readonly build_pause: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
  readonly build_rbac_grant: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number, number];
  readonly build_rbac_revoke: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number, number];
  readonly build_set_attester: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number, number];
  readonly build_set_max_supply: (a: number, b: number, c: number, d: number, e: bigint, f: number, g: number) => [number, number, number, number];
  readonly build_set_min_burn: (a: number, b: number, c: number, d: number, e: bigint, f: number, g: number) => [number, number, number, number];
  readonly build_set_note_fee: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: bigint, j: number, k: number) => [number, number, number, number];
  readonly current_max_supply: (a: number, b: number) => [bigint, number, number];
  readonly current_min_burn: (a: number, b: number) => [bigint, number, number];
  readonly current_token_supply: (a: number, b: number) => [bigint, number, number];
  readonly note_fee: (a: number, b: number, c: number, d: number) => [number, bigint, number, number];
  readonly rbac_role_members: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __externref_drop_slice: (a: number, b: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
