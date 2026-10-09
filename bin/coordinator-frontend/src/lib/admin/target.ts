import type { AdminAction } from '@/lib/admin/recipe';

/**
 * An admin *target* is the contract the console administers: the USDCx faucet or the AggLayer
 * bridge. Both are miden-standards RBAC + Pausable network accounts, so one engine serves both;
 * what differs (roles, actions, labels, the proposal-label prefix) lives in these profiles.
 */
export type AdminTargetKind = 'usdcx' | 'agglayer';

export interface RoleSpec {
  /** The on-chain role symbol (what the RBAC map and the wasm readers use). */
  symbol: string;
  /** What the UI shows; equals `symbol` except where the spec names a role differently. */
  label: string;
  description: string;
}

/** `actionRole` value for an action any role holder may perform (renounce). */
export const ANY_HELD_ROLE = '*';

export interface AdminTargetProfile {
  kind: AdminTargetKind;
  roles: readonly RoleSpec[];
  actions: readonly AdminAction[];
  actionRole: Readonly<Partial<Record<AdminAction, string>>>;
  /** The custom-proposal label prefix; see `encodeRecipeLabel`. */
  labelPrefix: string;
  labels: {
    consoleTitle: string;
    /** "USDCx faucet" / "AggLayer bridge", used in sentences. */
    contractNoun: string;
    /** "USDCx" / "AggLayer", for switcher chips and toasts. */
    contractShort: string;
    pauseTitle: string;
    unpauseTitle: string;
  };
}

export interface AdminTarget extends AdminTargetProfile {
  contractId: string;
  feeFaucetId: string;
  networkId: string;
}

export const USDCX_PROFILE: AdminTargetProfile = {
  kind: 'usdcx',
  roles: [
    { symbol: 'ADMIN', label: 'ADMIN', description: 'Root authority on the faucet: supply, fees, roles.' },
    { symbol: 'ATTEST_ADMIN', label: 'ATTEST_ADMIN', description: 'Enables and disables attesters.' },
    { symbol: 'DOM_PAUSER', label: 'DOM_PAUSER', description: 'Pauses the faucet domain.' },
    { symbol: 'DOM_UNPAUSER', label: 'DOM_UNPAUSER', description: 'Unpauses the faucet domain.' },
    { symbol: 'BLK_MANAGER', label: 'BLK_MANAGER', description: 'Blocks and unblocks accounts.' },
  ],
  actions: ['set_max_supply', 'set_min_burn', 'set_note_fee', 'rbac_grant', 'rbac_revoke', 'set_attester', 'pause', 'unpause', 'blocklist'],
  actionRole: {
    set_max_supply: 'ADMIN',
    set_min_burn: 'ADMIN',
    set_note_fee: 'ADMIN',
    rbac_grant: 'ADMIN',
    rbac_revoke: 'ADMIN',
    set_attester: 'ATTEST_ADMIN',
    pause: 'DOM_PAUSER',
    unpause: 'DOM_UNPAUSER',
    blocklist: 'BLK_MANAGER',
  },
  labelPrefix: 'usdcx_v1_',
  labels: {
    consoleTitle: 'USDCx Admin Console',
    contractNoun: 'USDCx faucet',
    contractShort: 'USDCx',
    pauseTitle: 'Pause USDCx',
    unpauseTitle: 'Unpause USDCx',
  },
};

export const AGGLAYER_PROFILE: AdminTargetProfile = {
  kind: 'agglayer',
  roles: [
    // The bridge's root role is the standards `ADMIN` symbol; the AggLayer spec calls it BRIDGE_ADMIN.
    { symbol: 'ADMIN', label: 'BRIDGE_ADMIN', description: 'Root authority. Grants and revokes every role, unpauses, updates policies. Must never be emptied.' },
    { symbol: 'PAUSER', label: 'PAUSER', description: 'Emergency stop. Pause only; unpause sits with BRIDGE_ADMIN.' },
    { symbol: 'FAUCET_MNGR', label: 'FAUCET_MNGR', description: 'Registers and deregisters bridged-token faucets (operational Gateway key).' },
    { symbol: 'GER_INJECTOR', label: 'GER_INJECTOR', description: 'Publishes new Global Exit Roots (operational Gateway key).' },
    { symbol: 'GER_REMOVER', label: 'GER_REMOVER', description: 'Removes a fraudulent or mistaken GER; works while paused.' },
    { symbol: 'FEE_MNGR', label: 'FEE_MNGR', description: "Updates the bridge's note fee schedule." },
  ],
  actions: ['rbac_grant', 'rbac_revoke', 'rbac_set_admin', 'rbac_renounce', 'pause', 'unpause'],
  actionRole: {
    rbac_grant: 'ADMIN',
    rbac_revoke: 'ADMIN',
    rbac_set_admin: 'ADMIN',
    rbac_renounce: ANY_HELD_ROLE,
    pause: 'PAUSER',
    unpause: 'ADMIN',
  },
  labelPrefix: 'agg_v1_',
  labels: {
    consoleTitle: 'AggLayer Bridge Admin Console',
    contractNoun: 'AggLayer bridge',
    contractShort: 'AggLayer',
    pauseTitle: 'Pause bridge',
    unpauseTitle: 'Unpause bridge',
  },
};

const PROFILES: Record<AdminTargetKind, AdminTargetProfile> = { usdcx: USDCX_PROFILE, agglayer: AGGLAYER_PROFILE };

export function profileOf(kind: AdminTargetKind): AdminTargetProfile {
  return PROFILES[kind];
}

export function roleSymbols(target: AdminTargetProfile): string[] {
  return target.roles.map((r) => r.symbol);
}

export function roleLabel(target: AdminTargetProfile, symbol: string): string {
  return target.roles.find((r) => r.symbol === symbol)?.label ?? symbol;
}

/** The on-chain role gating `action` on this target, `ANY_HELD_ROLE`, or `null` when the target has no such action. */
export function actionRoleOf(target: AdminTargetProfile, action: AdminAction): string | null {
  return target.actions.includes(action) ? (target.actionRole[action] ?? null) : null;
}

/**
 * The React key of an action's form. It carries the target kind: forms with the same action exist
 * on both targets (grant, revoke, pause, unpause), and keyed by action alone React would keep a
 * reviewed recipe, typed CONFIRM and selected role across a console switch and send them to the
 * other contract. Keyed by kind, a switch remounts every form.
 */
export function actionFormKey(kind: AdminTargetKind, action: AdminAction): string {
  return `${kind}:${action}`;
}
