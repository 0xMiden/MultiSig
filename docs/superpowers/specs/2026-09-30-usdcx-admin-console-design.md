# USDCx Admin Console — role-gated admin variant of the multisig frontend (v2, revised after baseline verification)

- **Date:** 2026-09-30 (v2 supersedes the initial draft the same day)
- **Status:** Revised design; **both open decisions resolved** (A: 0.17 faucet source verified against `0xMiden/miden-usdcx`; B: `fee_sponsorship` excluded → 8 notes). Ready for the implementation plan pending approval.
- **Scope:** USDCx faucet admin notes only. Agglayer deferred to a separate spec.
- **Baseline verified against real state:** `origin/main` = **`7f0f82e`** ("Migration- 0.17v", #28); canonical faucet = `~/Repos/miden-usdcx` (`c56552c`, miden 0.15); installed SDKs = `@miden-sdk` 0.17.0-rc.4 / `@openzeppelin/*` 0.18.0-rc.2.

## What the initial draft got factually wrong (corrections)

1. **"USDCx admin machinery survived the migration / is present on `main`" — FALSE.** `origin/main` (`7f0f82e`) contains **none** of it. The admin crates + FE files existed only as **untracked** files in a stale local tree (now preserved on branch `preserve/usdcx-admin-0.16`, commits `23aefe5`/`1115b25`).
2. **"Complete the existing mask" — WRONG framing.** This is a **port + build**: the 0.16.1 note builders must be ported to 0.17 and the mask built fresh on the merged FE. `usdcxAdmin.ts` / `AdminActionsPanel.tsx` do not exist on the base.
3. **The 5-role RBAC model is unverified.** The readable `miden-usdcx` faucet (0.15) is **single-owner** (`Ownable2Step` + `PausableManager` + `BlocklistOwnerControlled`) — it has **no RBAC and none of the 5 role symbols**; its README lists role separation as *future*. The RBAC/5-role model exists only in the **deployed 0.17 faucet, whose source is not in any tree** → the note→role gating is currently inferred, not verified (Decision A).
4. **"Role separation is a deployment convention" — understated.** It is enforced **nowhere** (not on-chain, and the `usdcx-deploy` tool does not exist in any tree). Same for **last-ADMIN / self-lockout** — the chain permits permanently revoking the final ADMIN. These must become **frontend guardrails**.
5. **`fee_sponsorship` "include with a warning" — unsafe as specified** (see §Open decision B): the current builder can permanently lock funds.
6. **Recipe `{action, serialHex, saltHex}` — insufficient** (§Deterministic reconstruction).

## Version matrix (verified)

| Component | Version | Note |
|---|---|---|
| FE `@miden-sdk/*` | 0.17.0-rc.4 | note serialization target |
| FE `@openzeppelin/*` | 0.18.0-rc.2 | `next` 15.5.26 |
| `usdcx-admin-notes` builders | miden **0.16.1** | port → 0.17 |
| `miden-usdcx` faucet (git) | miden **0.15**, single-owner | RBAC is only in the **deployed 0.17** faucet |
| MultiSig Rust workspace | miden-client **0.13** | coordinator-server deleted; out of scope |

**Port target = 0.17** (faucet redeployed on 0.17; a v0.17 contract is already on devnet).

## Decisions resolved

- **A — RESOLVED.** 0.17 faucet source = **`0xMiden/miden-usdcx`** (`e68f8bc`, miden **0.17.0-rc.7**). Role model **verified** against `crates/xusdc-encoding/src/account/xreserve/admin_authority.rs` (`XReserveAdminAuthority`): `DOM_PAUSER`→pause, `DOM_UNPAUSER`→unpause, `ATTEST_ADMIN`→set_attester, `BLK_MANAGER`→block/unblock; **every other authority-gated setter falls back to `ADMIN`** (set_max_supply, set_min_burn, set_note_fee, rbac grant/revoke). The assignment is **fixed in faucet code** (takes no args — cannot be misconfigured by a caller). Critically, **the faucet installs NO ownership component** — RBAC membership is the *only* authority handle, so revoking the last `ADMIN` is **permanent and unrecoverable** → the last-ADMIN/self-lockout guardrail is mandatory, not optional.
- **B — RESOLVED: exclude `fee_sponsorship` from v1** → **8 notes** (the language throughout says "8", not "9/all role notes"). Rationale: two-note paired workflow, **not RBAC-gated** (a fee note, not a faucet setter), and the current builder exposes no `reclaimer`/`reclaim_height` so a mis-paired note **locks funds permanently**. If ever needed: a separate advanced tool with the builder extended for reclaim params — never a simple mask row.

## Governance & the role model (VERIFIED — `0xMiden/miden-usdcx` `e68f8bc`)

Roles: `ADMIN` (built-in), `ATTEST_ADMIN`, `DOM_PAUSER`, `DOM_UNPAUSER`, `BLK_MANAGER`. Account model = **option (a)**: an admin loads whichever role-holding multisig they control; the mask shows only the actions that account's roles permit. Pause asymmetry: **pause** = `DOM_PAUSER` (1-of-N, one-shot) vs **unpause** = `DOM_UNPAUSER` (admin M-of-N) — a property of *which multisig holds which role* and *its threshold*, not an RBAC feature.

Notes (v1 = these 8; `fee_sponsorship` **excluded** per Decision B):

| Note (wasm builder) | Role (provisional) | Admin fields |
|---|---|---|
| `set_max_supply` | ADMIN | max_supply (u64) |
| `set_min_burn` | ADMIN | min_burn (u64 ≥1) |
| `set_note_fee` | ADMIN | note_script_root, **fee_faucet = native (read-only)**, fee_amount |
| `rbac_grant` / `rbac_revoke` | ADMIN | role, target account |
| `set_attester` | ATTEST_ADMIN | commitment (Word), enabled |
| `pause` / `unpause` | DOM_PAUSER / DOM_UNPAUSER | direction |
| `blocklist` (block/unblock) | BLK_MANAGER | target account, direction |

## RBAC safety — on-chain vs frontend guardrails (verified against miden-standards RBAC)

**On-chain (enforced):** grant/revoke require the note sender to hold the role's admin role; revoke target must currently hold the role; encoding validation. **Enforced nowhere (⇒ frontend guardrails, per your item 5):**
- **Last-ADMIN / self-lockout:** before a `rbac_revoke(ADMIN,…)` or a self-targeting revoke, read the faucet's ADMIN member count and **hard-block/confirm** if it would hit 0; warn when the acting multisig revokes its own administering role.
- **Role separation:** refuse to grant `DOM_PAUSER`/`BLK_MANAGER` to the admin multisig, and flag existing collisions on load.
- **Revoke-while-in-flight:** auth is checked at *consumption*; a note signed by an account whose role is later revoked fails on-chain at execute — warn when a queued revoke could invalidate an in-flight proposal, and surface the on-chain rejection cleanly.
- These are **operational guardrails, explicitly not protocol invariants** (the chain allows all of the above).

## Architecture & packaging (approach #1)

`NEXT_PUBLIC_APP_MODE` = `wallet` (default) | `admin`, a **build-time** Next.js var → the wallet and admin deployments are **two builds/tags from the same Dockerfile** (not a runtime switch on a prebuilt image). Admin mode: the mask is the dashboard home, and end-user wallet routes (Send/Receive) are **unavailable / redirected** (item 10 — not merely hidden). Shared components stay shared; admin mode only gates routes/nav/home content. Deploy = a second image build with `APP_MODE=admin` + its own env. Base = **fresh branch off `origin/main` `7f0f82e`**, porting the preserved 0.16 work.

## Rust crate + wasm (0.17 rebuild, port)

**Prefer building on upstream `xusdc-encoding` (0.17, in `0xMiden/miden-usdcx`) — the canonical 0.17 note/account encoding — over hand-porting the local 0.16 builders where they overlap.** `set_attester` (bespoke note) + `XReserveAdminAuthority` live there; pause/unpause/block/unblock use the standard `PausableManager`/`BlocklistManager` role-action procedures, and grant/revoke use the standard RBAC role-action note. The builder crate should wrap those 0.17 procedures (depending on / mirroring `xusdc-encoding`) rather than reproducing the 0.16.1 hand-rolled encoders. Then rebuild wasm (`wasm-pack build --target web --features wasm`), re-vendor into `src/lib/usdcxAdminWasm/`. **Guard-rail test:** a note built by the 0.17 wasm must `Note.deserialize` under `@miden-sdk` 0.17 **and** be consumable by the deployed 0.17 faucet (MockChain + devnet). `account_has_role` (in the wasm) reads the faucet's RBAC map — this is the role gate.

## Data flow & deterministic reconstruction (item 3)

Reuse the OZ custom-proposal recipe (model: `buildP2idTransactionRequest`): `feeAwareTransactionRequestBuilder(accountId, delta, salt, boundBlock)` → `.withOwnOutputNotes([adminNote])` → `buildMultisigRequest` → `createCustomProposal(request.serialize(), rawProposalType, {nonce})`. Execute (custom path, **new**): rebuild the **byte-identical** request from the persisted recipe → `advice = prepareCustomExecution(id, request.serialize())` → `builder.extendAdviceMap(advice).build()` → `submitTransaction(id, finalReq)`. (Built-ins use `executeProposal`; the surrounding sync/lock/relay/refresh scaffold in `handleExecuteProposal` is reused verbatim.)

**Persist a versioned canonical recipe** (OZ does not persist it), sufficient to rebuild deterministically on any signer's machine:
`{ recipeVersion, action, senderAccountId, faucetId, networkId, actionArgs{…}, serialHex, saltHex }`. The note serial is derived deterministically from the salt (Poseidon2 over salt felts, as `deriveP2idSerialNumber` does), so the recipe rebuilds bit-identically — required because `prepareCustomExecution` needs the same bytes, and per the SDK `chain-anchored-execution` skill **R1: never re-run a builder** (fresh serial/salt would break the binding). Also **store/verify the note-id / request-commitment**: reconstruction must reproduce the exact payload the cosigners approved; execution never depends on mutable UI state.

Caveat (from the SDK skill): the tx-summary commitment binds account delta + input/output **note commitments** + ref block + expiration + user params — it does **not** bind a custom tx *script*. We use **output notes** (whose commitments are bound), not a custom tx script, so the admin note is bound; noted so no one later moves logic into an unbound script.

## Review step before creation (item 4)

Reuse `ProposalDetails.tsx` — add a `case 'custom'` keyed on `metadata.rawProposalType` rendering a canonical, human-readable summary derived **from the persisted recipe** (not arbitrary form state): e.g. `Pause USDCx`, `Set max supply: X → Y`, `Grant BLK_MANAGER to 0x…`, `Revoke ATTEST_ADMIN from 0x…`. The same decode renders for every co-signer at sign time (`ApproveModal`/`PendingActions` already embed `ProposalDetails`).

## Note creation vs consumption states (item 6)

The FE observes proposal execution but **not** faucet consumption today — build it. States: `created → collecting signatures → threshold reached → executed / admin note created → awaiting faucet consumption → applied` (or `failed`). "Executed" = `proposal.status==='finalized'`; the **admin note id** is derived from the recipe salt (or extracted from the executed `txSummary` via `getOutputNotesFromTxSummary` → `note.id()`); "applied" = poll `RpcClient.getNotesById([noteId])` / `notes.list({status})` until the note shows consumed/nullified at the faucet. **Never report the admin change as succeeded merely because the multisig proposal executed.**

## Input validation (item 8)

- `u64` values parsed as **string→BigInt**, validated `0 ≤ x ≤ 2^64−1`; action constraints (`min_burn ≥ 1`). Never JS `number`. All amounts cross the WASM boundary as `BigInt` (SDK `AGENTS.md`).
- Exact formats/lengths for `Word`, `NoteId`, `NoteScriptRoot`, `commitment`, account IDs — validate before building; reject malformed.
- `set_note_fee.fee_faucet` is **read-only** = the configured native fee faucet (not just prefilled).
- Account IDs normalized via the existing util; reject wrong-network representations.
- `serial` auto-generated (never user input).

## Role gating as convenience (item 9)

UI-only; the faucet is authoritative. On load: sync/fetch the latest faucet account state; evaluate each role via the wasm `account_has_role`; **distinguish "does not have role" from "could not determine" (parse/sync failure)** — a failure surfaces an error state, never a silent "no actions." Refresh roles/state after an admin op is **actually consumed** (tie to the consumption poller), not merely executed.

## Route + environment safety (items 10, 11)

- Admin mode: end-user routes unavailable/redirected (middleware-level), not just hidden.
- Persistent, prominent header banner: **network**, **USDCx faucet id/account**, **loaded acting multisig**, and **roles detected** for it — to make wrong-deployment actions hard.

## Reuse (prefer existing patterns — your standing instruction)

Reuse verbatim: `runProposalCreation`, `handleSignProposal`, the `handleExecuteProposal` scaffold, `getProposalActionState`/`ProposalAction`, `ProposalDetails` (+`case 'custom'`), `useFaucetDecimals`/`TokenAmount`/`tokenAmounts`, `AccountInspector.fromAccount` + `activeCommitment`, `describeExecutionError`/toast contract, `getOutputNotesFromTxSummary`, and the OZ `feeAwareTransactionRequestBuilder`→`withOwnOutputNotes`→`buildMultisigRequest` recipe. Build new (small): the custom execute path (`prepareCustomExecution`+`submitTransaction`), the deterministic admin recipe, the `case 'custom'` renderer, the consumption poller, the wasm role gate wiring, and the mask forms.

## Testing (item 12)

Crate (0.17): 8 builders + `account_has_role`. Wasm round-trip: built note → `@miden-sdk` 0.17 `Note.deserialize` + execute (MockChain + consumable by 0.17 faucet). Frontend + e2e, including: unauthorized-role attempt; malformed/undeterminable faucet state (role-check failure ≠ no actions); last-ADMIN / self-lockout; role-separation guardrail; wrong-network account input; u64 overflow; malformed Word/NoteId/NoteScriptRoot lengths; browser-reload deterministic reconstruction; reconstruction on a second signer/browser; identical action displayed to multiple signers; stale faucet state; duplicate/pending admin notes; pause-while-paused / unpause-while-unpaused; **note created but ntx consumption fails** (state stays "awaiting", not "applied"); and **both `wallet` and `admin` builds compile in CI**. Per-note live devnet: create→sign→execute→ntx consumes with `note.failed.count=0`, pause via 1-of-N, unpause via majority.

## SDK integration rules (item 13 — from the installed `@miden-sdk` docs)

From the package's `AGENTS.md` + `skills/chain-anchored-execution` + `skills/web-client-usage`: amounts are `BigInt` at the boundary; the WASM client is single-threaded (serialize calls — the FE funnels through `MultisigContext`); sync before read; **use `feeAwareTransactionRequestBuilder`, not `new TransactionRequestBuilder()`**; 0.17 multisig executes **at the tip, no `ChainAnchor`**; **never re-run a builder** (rebuild from the stored salt); `summary.outputNotes()` includes the fee note — don't treat `[0]` as the admin note; `dist/` type declarations are authoritative.

## Out of scope
Agglayer (separate spec); key-at-rest encryption / RC→stable / Guardian-auth (mainnet gate #29); the deleted coordinator-server / 0.13 Rust workspace.
