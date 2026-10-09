import type { AdminTargetProfile } from '@/lib/admin/target';

export interface BridgeState {
  paused: boolean;
  /** Holder count per on-chain role symbol. */
  holderCounts: Record<string, number>;
}

export type BridgeStateResult = ({ status: 'ready' } & BridgeState) | { status: 'error'; message: string };

export interface BridgeReaders {
  listRoleHolders: (bytes: Uint8Array, target: AdminTargetProfile) => Record<string, string[]>;
  readIsPaused: (bytes: Uint8Array) => boolean;
}

/**
 * The bridge's paused flag and role holder counts from its account bytes. A read failure is an
 * `error` with its message, never "no state": a paused bridge whose bytes fail to parse must not
 * just lose its status cell.
 */
export function bridgeStateFromBytes(bytes: Uint8Array, target: AdminTargetProfile, read: BridgeReaders): BridgeStateResult {
  try {
    const holders = read.listRoleHolders(bytes, target);
    const holderCounts = Object.fromEntries(Object.entries(holders).map(([role, ids]) => [role, ids.length]));
    return { status: 'ready', paused: read.readIsPaused(bytes), holderCounts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', message: `Could not read the ${target.labels.contractNoun}'s state: ${message}` };
  }
}
