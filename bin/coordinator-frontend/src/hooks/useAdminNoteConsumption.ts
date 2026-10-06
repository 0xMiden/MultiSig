'use client';

import { useEffect, useState } from 'react';
import type { Proposal } from '@openzeppelin/miden-multisig-client';
import { useMultisig } from '@/contexts/MultisigContext';
import { initAdminWasm } from '@/lib/admin/noteBuilders';
import type { AdminRecipe } from '@/lib/admin/recipe';
import {
  deriveStateFromProposal,
  getNetworkNoteConsumption,
  isNoteConsumed,
  resolveAdminNoteId,
  type ConsumptionState,
} from '@/lib/admin/consumption';

/** How often to re-check whether the admin note has been consumed, once the proposal executes. */
const POLL_INTERVAL_MS = 4_000;

/**
 * How many CONSECUTIVE poll failures the poller tolerates before giving up and transitioning to
 * `failed`. A single error is almost always a transient RPC/network blip (the node is momentarily
 * unreachable, a request times out, ...) and must not be mistaken for the note having failed to
 * consume -- the note may well be consumed moments later. Any successful call (whether or not it
 * reports the note consumed) resets this counter to 0, so only a run of failures with no successful
 * call in between trips `failed`.
 */
export const MAX_CONSUMPTION_POLL_ERRORS = 5;

/**
 * An admin change's lifecycle state plus, when the node has one, the ntx-builder's reason the note
 * has not applied (`detail`). `detail` is surfaced to the user: it is the faucet-side execution
 * error for a note that executed on the multisig but the faucet rejects when consuming it (e.g.
 * "new max supply is less than current token supply"), which would otherwise be invisible.
 */
export interface AdminNoteConsumption {
  state: ConsumptionState;
  detail?: string;
}

/**
 * Tracks the full lifecycle of an admin change: the proposal-level state
 * (`created`/`collecting`/`threshold_reached`/`executed`, from `deriveStateFromProposal`), and --
 * once the proposal is `executed` -- whether its admin note has actually been consumed (nullified)
 * at the faucet, AND if not, why.
 *
 * CRITICAL: this never reports `applied` on proposal finalization alone. Once `executed`, it reports
 * `awaiting_consumption` and polls the live `MidenClient` from `useMultisig()` until the note is
 * confirmed consumed, only then transitioning to `applied` -- `applied` is set from no other path.
 *
 * The primary signal is the node's ntx-builder view (`getNetworkNoteConsumption` ->
 * `getNetworkNoteStatus`), which also carries the faucet's execution error: a `Discarded` note
 * becomes `failed` with that error in `detail`, and a note the node keeps re-attempting and failing
 * stays `awaiting_consumption` but surfaces its `lastError` in `detail` (so a deterministic
 * rejection, which may be retried indefinitely rather than ever `Discarded`, still shows the user
 * its reason). When the node has no ntx-builder record yet (`'not_found'` -- not yet ingested, or
 * consumed-and-dropped) the poller falls back to the local `isNoteConsumed` check to catch the
 * applied case, and otherwise keeps awaiting. Transient polling errors are tolerated (see
 * `MAX_CONSUMPTION_POLL_ERRORS`): the poller keeps retrying and only gives up (`failed`) after that
 * many consecutive failures with no intervening success. A failure to even start polling (resolving
 * the note id, or initializing the admin WASM module) is terminal immediately, since that is a
 * one-time setup step that fails the same way every retry.
 *
 * `recipe` may be `null` (still loading, or no recipe recoverable) -- then the state never advances
 * past `executed`, since there is no note id to poll. The interval is cleared on unmount and once a
 * terminal state (`applied`/`failed`) is reached.
 */
export function useAdminNoteConsumption(
  proposal: Proposal,
  recipe: AdminRecipe | null,
): AdminNoteConsumption {
  const { midenClient } = useMultisig();
  const baseState = deriveStateFromProposal(proposal);
  const [result, setResult] = useState<AdminNoteConsumption>({ state: baseState });

  useEffect(() => {
    if (baseState !== 'executed' || !recipe || !midenClient) {
      setResult({ state: baseState });
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

    setResult({ state: 'awaiting_consumption' });

    (async () => {
      let noteIdHex: string;
      try {
        await initAdminWasm();
        noteIdHex = resolveAdminNoteId(recipe);
      } catch {
        if (!cancelled) setResult({ state: 'failed' });
        return;
      }
      if (cancelled) return;

      let consecutiveErrors = 0;

      const check = async () => {
        try {
          const net = await getNetworkNoteConsumption(noteIdHex);
          if (cancelled) return;
          // A successful call -- whatever it reports -- clears any run of prior transient failures.
          consecutiveErrors = 0;

          if (net === 'not_found') {
            // No ntx-builder record yet: not ingested, or consumed-and-dropped. Catch the applied
            // case locally; otherwise keep awaiting.
            const consumed = await isNoteConsumed(midenClient, noteIdHex);
            if (cancelled) return;
            if (consumed) {
              setResult({ state: 'applied' });
              stop();
            }
            return;
          }

          if (net.state === 'applied') {
            setResult({ state: 'applied' });
            stop();
            return;
          }
          if (net.state === 'failed') {
            setResult({ state: 'failed', detail: net.detail });
            stop();
            return;
          }
          // awaiting_consumption: surface the node's last error (if any) while it keeps retrying.
          setResult({ state: 'awaiting_consumption', detail: net.detail });
        } catch {
          if (cancelled) return;
          consecutiveErrors += 1;
          if (consecutiveErrors >= MAX_CONSUMPTION_POLL_ERRORS) {
            setResult({ state: 'failed' });
            stop();
          }
          // Otherwise: transient blip. Stay in `awaiting_consumption` and keep polling -- do NOT
          // fail on the first (or Nth, below the cap) error.
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

  return result;
}
