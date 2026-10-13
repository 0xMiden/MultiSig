'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAdminTargets } from '@/config/adminConfig';
import type { AdminTarget, AdminTargetKind } from '@/lib/admin/target';
import { resolveShownTarget, type TargetEvaluation } from '@/lib/admin/targetSelection';
import { useAdminTargets, type AdminTargetsState } from '@/hooks/useAdminTargets';

export interface AdminTargetContextValue {
  state: AdminTargetsState;
  configured: AdminTarget[];
  /** The tab the user picked; `null` until they pick one (the console then lands where roles are held). */
  selectedKind: AdminTargetKind | null;
  /** Picks the console (USDCx or AggLayer) for every admin page. */
  selectKind: (kind: AdminTargetKind) => void;
  /**
   * The contract every admin page shows: the selected tab, else the first where someone holds a
   * role, else the first configured. Never a mix of two contracts.
   */
  shownTarget: AdminTarget | null;
  /** `shownTarget`'s evaluation; `null` until the contracts were read. */
  shownEvaluation: TargetEvaluation | null;
  /** `shownTarget`'s kind when the multisig or Bread holds a role on it; actions are then usable. */
  activeKind: AdminTargetKind | null;
  /** The evaluation behind `activeKind`; `null` when nobody holds a role on the shown contract. */
  active: TargetEvaluation | null;
  refresh: () => void;
}

const Ctx = createContext<AdminTargetContextValue | null>(null);

const STORAGE_KEY = 'adminTarget:selected';

function readSelected(): AdminTargetKind | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'usdcx' || v === 'agglayer' ? v : null;
  } catch {
    return null;
  }
}

const NO_EVALUATIONS: TargetEvaluation[] = [];

/** Which contract the console administers right now; see `resolveShownTarget` for the rule. */
export function AdminTargetProvider({ children }: { children: ReactNode }) {
  const { state, refresh } = useAdminTargets();
  const [selectedKind, setSelectedKind] = useState<AdminTargetKind | null>(null);
  const configured = useMemo(() => getAdminTargets(), []);
  useEffect(() => setSelectedKind(readSelected()), []);

  const evaluations = state.status === 'ready' ? state.evaluations : NO_EVALUATIONS;
  const { shownKind, activeKind } = useMemo(
    () => resolveShownTarget(configured, evaluations, selectedKind),
    [configured, evaluations, selectedKind],
  );
  const shownTarget = useMemo(() => configured.find((t) => t.kind === shownKind) ?? null, [configured, shownKind]);
  const shownEvaluation = useMemo(() => evaluations.find((e) => e.target.kind === shownKind) ?? null, [evaluations, shownKind]);
  const active = activeKind ? shownEvaluation : null;

  const selectKind = useCallback((kind: AdminTargetKind) => {
    setSelectedKind(kind);
    try {
      window.localStorage.setItem(STORAGE_KEY, kind);
    } catch {
      /* per-browser convenience only */
    }
  }, []);

  const value = useMemo<AdminTargetContextValue>(
    () => ({ state, configured, selectedKind, selectKind, shownTarget, shownEvaluation, activeKind, active, refresh }),
    [state, configured, selectedKind, selectKind, shownTarget, shownEvaluation, activeKind, active, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminTarget(): AdminTargetContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdminTarget must be used inside AdminTargetProvider (admin mode only)');
  return v;
}
