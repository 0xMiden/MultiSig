import type { AdminTarget, AdminTargetKind } from '@/lib/admin/target';
import { holdsAnyRole, type RoleFlags } from '@/lib/admin/roles';

/** One configured target, read from the node and evaluated for the two possible actors. */
export interface TargetEvaluation {
  target: AdminTarget;
  status: 'ready' | 'error';
  /** The contract's serialized `Account` bytes (ready only). */
  bytes?: Uint8Array;
  /** Roles of the acting multisig; `null` when no multisig is loaded. */
  roles: RoleFlags | null;
  /** Roles of the account connected through Bread; `null` when Bread is not the active source. */
  breadRoles: RoleFlags | null;
  breadAccountId: string | null;
  /** Why the read failed (error only). Never treated as "no roles". */
  message?: string;
}

export function evaluationHasRoles(e: TargetEvaluation): boolean {
  return e.status === 'ready' && (holdsAnyRole(e.roles) || holdsAnyRole(e.breadRoles));
}

/** The kinds where the multisig or Bread holds at least one role, in configured order. */
export function targetsWithRoles(evaluations: readonly TargetEvaluation[]): AdminTargetKind[] {
  return evaluations.filter(evaluationHasRoles).map((e) => e.target.kind);
}

/**
 * Which console to show: the one target where someone holds a role; with several, the remembered
 * choice if it still qualifies, else the first; none when nobody holds a role anywhere.
 */
export function selectActiveTarget(evaluations: readonly TargetEvaluation[], remembered: AdminTargetKind | null): AdminTargetKind | null {
  const candidates = targetsWithRoles(evaluations);
  if (candidates.length === 0) return null;
  if (remembered && candidates.includes(remembered)) return remembered;
  return candidates[0];
}

/** The targets whose contract could not be read. Their roles are unknown, never "none". */
export function failedEvaluations(evaluations: readonly TargetEvaluation[]): TargetEvaluation[] {
  return evaluations.filter((e) => e.status === 'error');
}

/** Whether "nobody holds a role" may be stated: only when every configured contract was read. */
export function allReadable(evaluations: readonly TargetEvaluation[]): boolean {
  return failedEvaluations(evaluations).length === 0;
}
