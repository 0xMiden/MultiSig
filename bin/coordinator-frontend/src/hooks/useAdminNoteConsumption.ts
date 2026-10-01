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
 * How many CONSECUTIVE `isNoteConsumed` failures the poller tolerates before giving up and
 * transitioning to `failed`. A single error is almost always a transient RPC/network blip (the
 * node is momentarily unreachable, a request times out, ...) and must not be mistaken for the
 * note having failed to consume -- the note may well be consumed moments later. Any successful
 * call (whether or not it reports the note consumed) resets this counter to 0, so only a run of
 * failures with no successful call in between trips `failed`.
 */
export const MAX_CONSUMPTION_POLL_ERRORS = 5;

/**
 * Tracks the full lifecycle of an admin change: the proposal-level state
 * (`created`/`collecting`/`threshold_reached`/`executed`, from `deriveStateFromProposal`), and --
 * once the proposal is `executed` -- whether its admin note has actually been consumed
 * (nullified) at the faucet.
 *
 * CRITICAL: this never reports `applied` on proposal finalization alone. Once `executed`, it
 * reports `awaiting_consumption` and polls `isNoteConsumed` against the live `MidenClient` from
 * `useMultisig()` until a real consumption check returns `true`, only then transitioning to
 * `applied` -- `applied` is set from no other path. Transient polling errors are tolerated (see
 * `MAX_CONSUMPTION_POLL_ERRORS`): the poller keeps retrying on the same interval and only gives
 * up (`failed`) after that many consecutive failures with no intervening success. A failure to
 * even start polling (resolving the note id, or initializing the admin WASM module) is treated as
 * terminal immediately, since that is a one-time setup step, not a repeated network call -- it
 * fails the same way every time it's retried.
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

      let consecutiveErrors = 0;

      const check = async () => {
        try {
          const consumed = await isNoteConsumed(midenClient, noteIdHex);
          if (cancelled) return;
          // A successful call -- consumed or not -- clears any run of prior transient failures.
          consecutiveErrors = 0;
          if (consumed) {
            setState('applied');
            stop();
          }
        } catch {
          if (cancelled) return;
          consecutiveErrors += 1;
          if (consecutiveErrors >= MAX_CONSUMPTION_POLL_ERRORS) {
            setState('failed');
            stop();
          }
          // Otherwise: treat as a transient blip. Stay in `awaiting_consumption` and keep
          // polling on the same interval -- do NOT fail on the first (or Nth, below the cap)
          // error.
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
