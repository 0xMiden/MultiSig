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

/**
 * The first of `preferred` that is configured, else the first configured target. The admin page
 * passes (active, inspected): with no active console it still shows the inspected (or first)
 * contract's state and locked actions. The roles page passes (inspected, active).
 */
export function firstConfiguredKind(
  configured: readonly Pick<AdminTarget, 'kind'>[],
  ...preferred: (AdminTargetKind | null)[]
): AdminTargetKind | null {
  for (const kind of preferred) {
    if (kind && configured.some((t) => t.kind === kind)) return kind;
  }
  return configured[0]?.kind ?? null;
}

/**
 * Whether the admin page lists the shown target's actions (usable ones as forms, the rest locked).
 * With nobody connected every action is locked, as a fact. With someone connected, only once the
 * shown contract was read: while detecting, or after a failed read, "locked" would be a guess.
 */
export function showsActionCards(anyone: boolean, shown: Pick<TargetEvaluation, 'status'> | null): boolean {
  if (!anyone) return true;
  return shown?.status === 'ready';
}

/** Who is connected, for the sentence that explains why every action is locked. */
export function noRolesSentence(
  parties: { multisig: boolean; bread: boolean },
  configured: readonly Pick<AdminTarget, 'contractId' | 'labels'>[],
): string {
  const on = configured.map((t) => `the ${t.labels.contractNoun} (${t.contractId})`).join(' or ');
  const subject =
    parties.multisig && parties.bread
      ? `Neither the acting multisig nor the connected Bread account holds a role on ${on}`
      : parties.multisig
        ? `The acting multisig holds no role on ${on}`
        : `The connected Bread account holds no role on ${on}`;
  return `${subject}, so every action below is locked. The Roles page shows who holds each role.`;
}
