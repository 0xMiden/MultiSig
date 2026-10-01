'use client';

import { useEffect, useState } from 'react';
import type { Proposal } from '@openzeppelin/miden-multisig-client';
import { useMultisig } from '@/contexts/MultisigContext';
import { initAdminWasm } from '@/lib/admin/noteBuilders';
import type { AdminRecipe } from '@/lib/admin/recipe';
import {
  deriveStateFromProposal,
  isNoteConsumed,
  resolveAdminNoteId,
  type ConsumptionState,
} from '@/lib/admin/consumption';

/** How often to re-check whether the admin note has been consumed, once the proposal executes. */
const POLL_INTERVAL_MS = 4_000;

/**
 * Tracks the full lifecycle of an admin change: the proposal-level state
 * (`created`/`collecting`/`threshold_reached`/`executed`, from `deriveStateFromProposal`), and --
 * once the proposal is `executed` -- whether its admin note has actually been consumed
 * (nullified) at the faucet.
 *
 * CRITICAL: this never reports `applied` on proposal finalization alone. Once `executed`, it
 * reports `awaiting_consumption` and polls `isNoteConsumed` against the live `MidenClient` from
 * `useMultisig()` until a real consumption check succeeds, only then transitioning to `applied`.
 * A terminal error from that check (note id resolution, or the node query) transitions to
 * `failed` instead.
 *
 * `recipe` may be `null` (e.g. still loading, or no recipe could be recovered for this
 * proposal) -- in that case the state never advances past `executed`, since there is no note id
 * to poll for. The polling interval is cleared on unmount and once a terminal state
 * (`applied`/`failed`) is reached.
 */
export function useAdminNoteConsumption(
  proposal: Proposal,
  recipe: AdminRecipe | null,
): ConsumptionState {
  const { midenClient } = useMultisig();
  const baseState = deriveStateFromProposal(proposal);
  const [state, setState] = useState<ConsumptionState>(baseState);

  useEffect(() => {
    if (baseState !== 'executed' || !recipe || !midenClient) {
      setState(baseState);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    setState('awaiting_consumption');

    (async () => {
      let noteIdHex: string;
      try {
        await initAdminWasm();
        noteIdHex = resolveAdminNoteId(recipe);
      } catch {
        if (!cancelled) setState('failed');
        return;
      }
      if (cancelled) return;

      const check = async () => {
        try {
          const consumed = await isNoteConsumed(midenClient, noteIdHex);
          if (cancelled) return;
          if (consumed) {
            setState('applied');
            stop();
          }
        } catch {
          if (cancelled) return;
          setState('failed');
          stop();
        }
      };

      await check();
      if (!cancelled) {
        timer = setInterval(check, POLL_INTERVAL_MS);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [baseState, recipe, midenClient]);

  return state;
}
