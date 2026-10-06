/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const account_has_role: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
export const build_blocklist: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number, number];
export const build_pause: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
export const build_rbac_grant: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number, number];
export const build_rbac_revoke: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number, number];
export const build_set_attester: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number, number];
export const build_set_max_supply: (a: number, b: number, c: number, d: number, e: bigint, f: number, g: number) => [number, number, number, number];
export const build_set_min_burn: (a: number, b: number, c: number, d: number, e: bigint, f: number, g: number) => [number, number, number, number];
export const build_set_note_fee: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: bigint, j: number, k: number) => [number, number, number, number];
export const current_max_supply: (a: number, b: number) => [bigint, number, number];
export const current_min_burn: (a: number, b: number) => [bigint, number, number];
export const current_token_supply: (a: number, b: number) => [bigint, number, number];
export const note_fee: (a: number, b: number, c: number, d: number) => [number, bigint, number, number];
export const rbac_role_members: (a: number, b: number, c: number, d: number) => [number, number, number, number];
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __externref_table_dealloc: (a: number) => void;
export const __externref_drop_slice: (a: number, b: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
