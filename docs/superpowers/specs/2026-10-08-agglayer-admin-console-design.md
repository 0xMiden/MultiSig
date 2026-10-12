# AggLayer bridge admin console — design

Date: 2026-10-08. Status: approved in conversation, awaiting written review.

## 1. Goal

Extend the admin console (branch `usdcx-admin-console-impl`) so the same deployment can
administer the Miden AggLayer bridge contract as well as the USDCx faucet. Once connected, the
console looks at which roles the acting account holds on each configured contract and shows the
matching console. The bridge is not yet deployed on testnet; until its id is configured the
console behaves exactly as today.

Vocabulary used throughout: a **target** is the contract being administered (USDCx faucet or
AggLayer bridge); a **proposal** is a multisig action not yet on chain; a **transaction** is on
chain.

## 2. What the bridge needs (facts from `miden-agglayer` 0.17.1 and its SPEC.md)

- The bridge is a network account built on the same miden-standards components as the USDCx
  faucet: `RoleBasedAccessControl` (maps `role_config` and `role_membership`, key
  `[0, role_symbol, acct_suffix, acct_prefix]` -> `[1,0,0,0]`), `Authority::RbacControlled`,
  `Pausable` (`is_paused` value slot, `[1,0,0,0]` when paused) and `AuthNetworkAccount` (fee
  schedule, allowlists, `estimate_note_fee`). Storage layout for roles and pause is identical to
  USDCx, so the existing readers apply unchanged once they accept arbitrary role names.
- Bridge roles (on-chain symbols): `ADMIN` (the spec's **BRIDGE_ADMIN**), `PAUSER`, `FAUCET_MNGR`,
  `GER_INJECTOR`, `GER_REMOVER`, `FEE_MNGR`. **FAUCET_ADMIN** is each wrapped faucet's own
  `ADMIN` role and is not stored on the bridge. Every bridge role's admin role is `ADMIN`.
- Role management uses the standard `RBAC_CONFIG` note (`RbacConfig::{GrantRole, RevokeRole,
  SetRoleAdmin, RenounceRole}`); pause/unpause use `PAUSE_CONFIG` (`Pause` needs PAUSER,
  `Unpause` needs ADMIN). Both are on the bridge's note allowlist. Our crate already builds
  grant/revoke/pause for USDCx with a target-agnostic signature.
- Fees: as for USDCx, the note creator's transaction creates a FEE_SPONSORSHIP companion sized
  by an FPI into the target's `estimate_note_fee`; the bridge is the foreign account.
- Spec caveats the console must respect: BRIDGE_ADMIN must never be emptied; pending-note
  consumption order is not controllable, so an ADMIN grant and an ADMIN revoke must not be in
  flight simultaneously.
- The local `miden-base` checkout predates RBAC. The published crate 0.17.1 matches the roles
  table. The crate version is pinned to what the deployed testnet bridge runs (to confirm when
  it is deployed); `miden-agglayer` is a dev/testing dependency only.

## 3. Scope

In scope (v1):
- Role management on the bridge: grant, revoke, set role admin, renounce.
- Pause (PAUSER, incl. a Bread-held pauser through the direct path) and unpause (BRIDGE_ADMIN).
- Roles page for the bridge, bridge state card (paused flag, holder counts), banner.
- Target detection and switcher; History/Transactions annotation per target.

Out of scope (v1): faucet register/deregister, GER inject/remove, fee policy, allowlist
(NETWORK_ACCOUNT_CONFIG) notes, faucet-level FAUCET_ADMIN administration. The data model leaves
room for them (actions are per-target lists).

USDCx behaviour is unchanged: same roles, same nine actions, same labels.

## 4. Rust crate: `crates/usdcx-admin-notes` (name kept)

Changes in `lib.rs`:
- `role_symbol(&str)` accepts any valid role symbol (`RoleSymbol::new`), not only the five USDCx
  names. Invalid symbols keep returning `AdminNoteError::Role`.
- New builders, mirroring `rbac`:
  - `rbac_set_admin(target, sender, role: RoleSymbol, admin_role: Option<RoleSymbol>, serial)`
  - `rbac_renounce(target, sender, role: RoleSymbol, serial)`
- New reader `is_paused(&Account) -> bool` reading the `Pausable` `is_paused` slot.
- `admin_note_kinds()` already lists RbacConfigNote and PauseConfigNote; unchanged.

`wasm.rs` exports added: `build_rbac_set_admin(target_hex, sender_hex, role, admin_role: Option<String>,
serial)`, `build_rbac_renounce(target_hex, sender_hex, role, serial)`, `is_paused(account_bytes)`.
Existing export names keep their `faucet_*` parameter names (JS interop is positional).

Tests:
- `tests/roles.rs`: `role_symbol` accepts `BRIDGE`-style names (`PAUSER`, `GER_INJECTOR`).
- New `tests/agglayer_roundtrip_0_17.rs` (feature `testing`): a MockChain with a bridge from
  `miden_agglayer::testing::create_existing_bridge_account_with_roles(...)`; the multisig
  stand-in holds ADMIN. Cases: ADMIN grants PAUSER (membership readable afterwards); ADMIN
  revokes it; PAUSER pauses (`is_paused` true); non-PAUSER pause fails; ADMIN unpauses;
  set_role_admin applies; renounce applies; non-ADMIN grant fails.
- `tests/allowlist.rs` gains the bridge: every v1 bridge note root is in
  `AggLayerBridge::allowed_notes()`.

Re-vendor the wasm into `bin/coordinator-frontend/src/lib/usdcxAdminWasm` with the documented
`wasm-pack build --target web --features wasm` command; the TS roundtrip suite covers the new
builders.

## 5. Frontend: target abstraction

New `src/lib/admin/target.ts`:

```ts
type AdminTargetKind = 'usdcx' | 'agglayer';
interface AdminTarget {
  kind: AdminTargetKind;
  contractId: string;          // faucet id or bridge id
  feeFaucetId: string;
  networkId: string;
  roles: readonly RoleSpec[];  // { symbol: on-chain name, label: display name, description }
  actions: readonly AdminAction[];
  actionRole: Record<AdminAction, string>;  // on-chain role symbol
  labels: { consoleTitle; contractNoun; pauseTitle; unpauseTitle; labelPrefix };
}
```

Profiles:
- `usdcx`: roles ADMIN, ATTEST_ADMIN, DOM_PAUSER, DOM_UNPAUSER, BLK_MANAGER; the existing nine
  actions; label prefix `usdcx_v1_`; labels as today.
- `agglayer`: roles ADMIN (label BRIDGE_ADMIN), PAUSER, FAUCET_MNGR, GER_INJECTOR, GER_REMOVER,
  FEE_MNGR; actions `rbac_grant`, `rbac_revoke`, `rbac_set_admin`, `rbac_renounce`, `pause`,
  `unpause`; `actionRole`: grant/revoke/set_admin/unpause -> ADMIN, pause -> PAUSER. Renounce
  has no single required role: it is offered when the sender holds any bridge role, and its role
  select lists only the roles that sender holds (the sender resolver treats `actionRole` value
  `'*'` as "any role held"). Label prefix `agg_v1_`; contract noun "AggLayer bridge".
  The roles page shows a note that FAUCET_ADMIN lives on each wrapped faucet.

Config (`adminConfig.ts`): adds `NEXT_PUBLIC_AGGLAYER_BRIDGE_ID` (empty = AggLayer disabled).
`getAdminConfig()` returns the list of configured targets. `assertAdminConfig` is removed or
wired; today it is dead code.

Recipe (`recipe.ts`): `AdminRecipe` gains `target: AdminTargetKind` and `contractId` replaces
`faucetId` (the `feeFaucetId` field stays). `recipeVersion` becomes 2; decoding a version-1
recipe yields `target: 'usdcx'`, so existing proposals keep working. `encodeRecipeLabel` uses the
target's prefix; `decodeRecipeLabel` accepts both prefixes. New `AdminActionArgs` variants:
`rbac_set_admin { role, adminRole: string | null }`, `rbac_renounce { role }`.

Note building (`noteBuilders.ts`): `buildAdminNoteBytes` dispatches the two new actions; the
target id passed to wasm is `recipe.contractId`.

Roles (`roles.ts`): `evaluateRoles(bytes, accountHex, target)` and `listRoleHolders(bytes,
target)` iterate `target.roles`; `ACTION_ROLE`/`ACTION_INFO` become per-target through the
profile. `actionsOfRole(target, role)` likewise.

Guardrails (`guardrails.ts`): parameterised by target. Shared: block revoking/renouncing the
last ADMIN; warn when the acting multisig revokes its own ADMIN; warn when the revoke target is
the sender of an in-flight recipe. USDCx-only: the DOM_PAUSER/BLK_MANAGER separation rule.
AggLayer-only: warn when an ADMIN grant and an ADMIN revoke/renounce are in flight at the same
time (consumption order caveat).

Describe (`describe.ts`): titles use `target.labels` ("Pause bridge", "Unpause bridge", "Set
role admin", "Renounce role").

Direct action (`directAction.ts`): the foreign account is `recipe.contractId`; `resolveActionSender`
uses the target's `actionRole`.

History annotation (`annotate.ts`, `useOnChainHistory.ts`): `TargetTags` carries one tag per
configured target plus the fee faucet; a note's role becomes `admin` for either contract and the
label names the contract. `indexKnownProposals` decodes both label prefixes.

Storage keys: recipes stay under `usdcxAdminRecipe:<proposalId>` (key rename not worth a
migration); the active-target choice is `adminTarget:<accountId>`.

## 6. Detection and navigation

New hook `useAdminTargets()` (replaces `useFaucetRoles` + `useFaucetAccountBytes` as the
entry point; both are kept as per-target internals): for each configured target, fetch the
contract account bytes from the node and evaluate the roles of the multisig and, when Bread is
the active wallet, of the Bread account. Result per target: `{ target, bytes, roles, breadRoles }`
or an error. Loading and errors never degrade to "no roles".

Selection (pure function `selectActiveTarget(results, remembered)`):
- exactly one target where multisig or Bread holds any role -> that target;
- both -> the remembered choice if it holds roles, else the first; the header shows a
  USDCx / AggLayer switcher;
- none -> no active target; the admin page shows "No admin roles" with both contract ids and
  the evaluated account ids; the roles page still lets the user pick a target to inspect.

`AdminTargetContext` provides `{ targets, active, setActive }`; the admin page, roles page,
banner, proposal list, action cards, History and Transactions pages read it. The sidebar is
unchanged. Routes are unchanged (`/dashboard/admin`, `/dashboard/admin/roles`).

## 7. AggLayer screens

- Banner: "AggLayer Bridge Admin Console", network, bridge id (hex + bech32), roles held by the
  multisig and by Bread; the switcher when both targets have roles.
- Bridge state card: paused / not paused (`is_paused`), holder count per role from the role
  membership map, refresh.
- Action cards (shared engine `AdminActionCard`): Grant role, Revoke role, Set role admin,
  Renounce role (role select over the bridge roles), Pause, Unpause. Sender resolution as today:
  multisig if it holds the role, else Bread, else locked.
- Roles page: six bridge roles with holders and "Can:" lists; a note about FAUCET_ADMIN.
- Proposal list and History: unchanged components, labels from the active target.

## 8. Error handling

- Missing bridge id: the target is simply absent; no error.
- Bridge account not found / private on the node: that target reports an error in the banner
  and is excluded from selection; the other target still works.
- Wasm or RPC failures while evaluating roles: shown, never treated as "no roles".
- Proposal creation/execution errors: unchanged paths (`runProposalCreation`,
  `executeCustomProposal`), with the target's noun in messages.

## 9. Testing

Rust: section 4. TypeScript (`tests/admin`): `target.test.ts` (profiles, action-role maps,
`selectActiveTarget` cases), `recipe.test.ts` (v1 decode -> usdcx, `agg_v1_` round trip, label
regex survival), `noteBuilders.test.ts` (set_admin, renounce bytes deserialize), `guardrails.test.ts`
(bridge rules), `describe.test.ts` (bridge titles), `roles.test.ts` (per-target evaluation),
`directAction.test.ts` (bridge as foreign account), `annotate` tests for two targets.
`tests/roundtrip/deserialize.test.ts` covers the new builders. `tsc`, eslint, wallet and admin
`next build`.

Live verification happens when the testnet bridge exists: connect the BRIDGE_ADMIN multisig,
grant PAUSER to a Bread account, pause via Bread, unpause via the multisig, and read the
History page. Until then the deployment with the env var unset is a no-op for users.

## 10. Rollout

1. Crate + wasm re-vendor (section 4), committed on its own.
2. Target abstraction and config, USDCx behaviour pinned by the existing tests.
3. Detection, context, switcher.
4. AggLayer screens and guardrails.
5. Deploy to the testnet console with the bridge id unset; set
   `NEXT_PUBLIC_AGGLAYER_BRIDGE_ID` once the bridge is deployed.
