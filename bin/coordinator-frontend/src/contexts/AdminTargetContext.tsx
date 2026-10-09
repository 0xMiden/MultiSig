'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMultisig } from '@/contexts/MultisigContext';
import { getAdminTargets } from '@/config/adminConfig';
import type { AdminTarget, AdminTargetKind } from '@/lib/admin/target';
import { firstConfiguredKind, selectActiveTarget, targetsWithRoles, type TargetEvaluation } from '@/lib/admin/targetSelection';
import { useAdminTargets, type AdminTargetsState } from '@/hooks/useAdminTargets';

export interface AdminTargetContextValue {
  state: AdminTargetsState;
  configured: AdminTarget[];
  activeKind: AdminTargetKind | null;
  active: TargetEvaluation | null;
  switchable: AdminTargetKind[];
  setActiveKind: (kind: AdminTargetKind) => void;
  /** The contract picked on the roles page; inspection only, never changes the active console. */
  inspectKind: AdminTargetKind | null;
  setInspectKind: (kind: AdminTargetKind) => void;
  /**
   * The contract the admin page shows: the active one, else the inspected one, else the first
   * configured. Without an active console its actions are all locked.
   */
  shownTarget: AdminTarget | null;
  /** `shownTarget`'s evaluation; `null` until the contracts were read. */
  shownEvaluation: TargetEvaluation | null;
  refresh: () => void;
}

const Ctx = createContext<AdminTargetContextValue | null>(null);

const storageKey = (accountId: string | null) => `adminTarget:${(accountId ?? 'none').toLowerCase()}`;

function readRemembered(accountId: string | null): AdminTargetKind | null {
  try {
    const v = window.localStorage.getItem(storageKey(accountId));
    return v === 'usdcx' || v === 'agglayer' ? v : null;
  } catch {
    return null;
  }
}

const NO_EVALUATIONS: TargetEvaluation[] = [];

/** Which contract the console administers right now; see `selectActiveTarget` for the rule. */
export function AdminTargetProvider({ children }: { children: ReactNode }) {
  const { multisig } = useMultisig();
  const { state, refresh } = useAdminTargets();
  const accountId = multisig?.accountId ?? null;
  const [remembered, setRemembered] = useState<AdminTargetKind | null>(null);
  const [inspectKind, setInspectKind] = useState<AdminTargetKind | null>(null);
  const configured = useMemo(() => getAdminTargets(), []);
  useEffect(() => setRemembered(readRemembered(accountId)), [accountId]);

  const evaluations = state.status === 'ready' ? state.evaluations : NO_EVALUATIONS;
  const activeKind = useMemo(() => selectActiveTarget(evaluations, remembered), [evaluations, remembered]);
  const switchable = useMemo(() => targetsWithRoles(evaluations), [evaluations]);
  const active = useMemo(() => evaluations.find((e) => e.target.kind === activeKind) ?? null, [evaluations, activeKind]);
  const shownKind = firstConfiguredKind(configured, activeKind, inspectKind);
  const shownTarget = useMemo(() => configured.find((t) => t.kind === shownKind) ?? null, [configured, shownKind]);
  const shownEvaluation = useMemo(() => evaluations.find((e) => e.target.kind === shownKind) ?? null, [evaluations, shownKind]);

  const setActiveKind = useCallback(
    (kind: AdminTargetKind) => {
      setRemembered(kind);
      try {
        window.localStorage.setItem(storageKey(accountId), kind);
      } catch {
        /* per-browser convenience only */
      }
    },
    [accountId],
  );

  const value = useMemo<AdminTargetContextValue>(
    () => ({
      state,
      configured,
      activeKind,
      active,
      switchable,
      setActiveKind,
      inspectKind,
      setInspectKind,
      shownTarget,
      shownEvaluation,
      refresh,
    }),
    [state, configured, activeKind, active, switchable, setActiveKind, inspectKind, shownTarget, shownEvaluation, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminTarget(): AdminTargetContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdminTarget must be used inside AdminTargetProvider (admin mode only)');
  return v;
}
