import { roleLabel, type AdminTargetProfile } from '@/lib/admin/target';

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

export interface PauseStatus {
  paused: boolean;
  /** "PAUSED" / "Running": the word shown large. */
  headline: string;
  detail: string;
}

/**
 * The pause status to show for the contract, from its read state. `null` while the state is
 * unread or failed to read: the console must never present "Running" as a default.
 */
export function pauseStatus(result: BridgeStateResult | null, target: AdminTargetProfile): PauseStatus | null {
  if (!result || result.status !== 'ready') return null;
  const noun = target.labels.contractNoun;
  if (!result.paused) return { paused: false, headline: 'Running', detail: `The ${noun} is not paused.` };
  const unpauser = target.actionRole.unpause;
  const who = unpauser ? roleLabel(target, unpauser) : 'an authorized role';
  return {
    paused: true,
    headline: 'PAUSED',
    detail: `The ${noun} is paused: its operations are stopped until ${who} unpauses it.`,
  };
}
