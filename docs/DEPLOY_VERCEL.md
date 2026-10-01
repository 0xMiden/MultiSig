# Deploying the USDCx Admin Console to Vercel

This covers deploying `bin/coordinator-frontend` in **admin mode**
(`NEXT_PUBLIC_APP_MODE=admin`) to Vercel, and the manual devnet end-to-end
checklist to run against that deployment afterward. The same app and the same
Vercel project can also serve the default **wallet mode** build (omit
`NEXT_PUBLIC_APP_MODE`, or set it to anything other than `admin`) --
`src/config/appMode.ts` is the only switch.

## Project setup

This is a monorepo: the Next.js app lives at `bin/coordinator-frontend`, not
the repo root.

- **Root Directory:** set the Vercel project's Root Directory to
  `bin/coordinator-frontend`. `vercel.json` in that directory pins
  `framework: nextjs`, `installCommand: npm ci`, and `buildCommand: npm run
  build`.
- `next.config.mjs` sets `output: 'standalone'`. That setting is for the
  Docker self-host path (`Dockerfile.coordinator-frontend`) -- Vercel's
  builder ignores it and supplies its own output/runtime packaging. No
  action needed; it is harmless to leave in place for a Vercel deploy.
- Node 20+ (the app's `engines.node` requirement); Vercel's current default
  Node runtime satisfies this.

## Required environment variables (admin deploy)

Set these as Vercel Project → Settings → Environment Variables, scoped to
whichever Vercel environment (Production/Preview) is being used for the
admin console:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_MODE` | `admin` | Switches the build to the admin console (`src/config/appMode.ts`). Without this the app builds and serves the wallet instead. |
| `NEXT_PUBLIC_USDCX_FAUCET_ID` | the USDCx faucet account ID this console administers | Required at runtime by `assertAdminConfig()` (`src/config/adminConfig.ts`); the build itself does not validate the value but every admin action will throw without it. |
| `NEXT_PUBLIC_USDCX_FEE_FAUCET_ID` | the chain's native fee faucet account ID | Read-only reference used by `set_note_fee`. |
| `NEXT_PUBLIC_GUARDIAN_ENDPOINT` | `https://guardian-devnet.openzeppelin.com` | Guardian instance (v0.18.0-rc.2) the console talks to. |
| `NEXT_PUBLIC_MIDEN_RPC_URL` | `devnet` (or a concrete RPC URL) | Miden SDK endpoint shorthand; must be the same network as Guardian. |
| `NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL` | `devnet` | Note transport endpoint; same network as the RPC. |
| `NEXT_PUBLIC_MIDEN_NETWORK` | `devnet` | Network identity used for the Bech32 address prefix (`src/lib/midenNetwork.ts`); set explicitly rather than relying on inference when `NEXT_PUBLIC_MIDEN_RPC_URL` is a raw URL. |
| `NEXT_PUBLIC_PARA_API_KEY` | Para project API key | Optional external signer integration; required if Para sign-in is offered on this deployment. |
| `NEXT_PUBLIC_PARA_ENVIRONMENT` | `production` | Use `production` for a real devnet deploy -- `development` points Para's CSP allowances (`src/lib/securityHeaders.ts`) at `localhost`, which is wrong off of a dev machine. |

Optional, deployment-dependent:

| Variable | When needed |
|---|---|
| `NEXT_PUBLIC_MIDEN_PROVER_URL` | Only if opting into a remote prover instead of in-browser proving. Accepts full transaction witnesses (including private note contents) -- a deliberate security trade-off, see `.env.example`. |
| `NEXT_PUBLIC_MIDEN_REGISTRATION_CODE` | Devnet invitation code for new-account registration/funding; defaults to `guardian`. |
| `NEXT_PUBLIC_CHAT_ENDPOINT` | Assistant endpoint, if enabled. |
| `NEXT_PUBLIC_CSP_CONNECT_SRC` | See CSP section below. |

### Content-Security-Policy allowlist

`src/lib/securityHeaders.ts` builds `connect-src` from a fixed set plus the
configured service origins: `'self'`, `https://*.miden.io` (Miden SDK
shorthands), `https://*.openzeppelin.com` (Guardian), the concrete origins of
`NEXT_PUBLIC_GUARDIAN_ENDPOINT` / `NEXT_PUBLIC_MIDEN_RPC_URL` /
`NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL` / `NEXT_PUBLIC_MIDEN_PROVER_URL` /
`NEXT_PUBLIC_CHAT_ENDPOINT` (via `originOf`, so shorthands like `devnet` that
aren't absolute URLs don't need to appear here), and Para's origins
(`https://*.getpara.com`, `wss://*.getpara.com`, `https://*.usecapsule.com`
in production mode).

For the default devnet values above (`guardian-devnet.openzeppelin.com` under
`*.openzeppelin.com`, `rpc.devnet.miden.io`/`devnet` shorthand under
`*.miden.io`), **no `NEXT_PUBLIC_CSP_CONNECT_SRC` addition is needed**. Add an
origin there (space- or comma-separated) only if:

- a self-hosted or non-devnet Guardian instance is entered at runtime (the
  console's own guardian-URL check in `src/lib/guardianUrl.ts` names this
  variable in its error message), or
- `NEXT_PUBLIC_MIDEN_RPC_URL` / `NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL` /
  `NEXT_PUBLIC_MIDEN_PROVER_URL` point at a concrete URL outside
  `*.miden.io` (e.g. a self-hosted node or prover).

## CI gate

`.github/workflows/test.yml`'s `frontend` job builds **both** app modes on
every PR and push (wallet `npm run build`, then an admin build with
`NEXT_PUBLIC_APP_MODE=admin` and placeholder faucet IDs), plus `npm run
test:admin`. A Vercel deploy should never be the first place an admin-mode
compile error is discovered -- if the admin build step in CI is red, do not
deploy.

## 0.17 operational window: proposal expiry

A custom admin proposal built by this console (`src/lib/admin/noteBuilders.ts`)
binds a specific block number (`boundBlockNum`) at creation time for
deterministic cross-signer reconstruction. On Miden 0.17:

- the node prunes account history after ~50 blocks, and
- a transaction expires ~20 blocks after its reference block.

A proposal must be **executed within that pruning/expiry window** after
creation, or it can no longer be built/executed and must be **re-created**
from scratch (new proposal, new bound block, fresh signatures). This is an
operational characteristic of the chain, not a defect to engineer around --
it is surfaced to operators via the admin banner and via
`describeExecutionError` (`src/lib/errors.ts`) wrapping the node's expiry/
pruning error when execution is attempted too late.

## Manual devnet end-to-end checklist

This is a **manual** checklist to run by hand against a live devnet
deployment after it goes up -- it is not automated by Task 14 or by CI. Use
at least two signer identities (e.g. two Ledger/Para accounts, or two local
multisig members) so the second-signer and role-gating checks are real.

For **each of the 9 admin actions** (`set_max_supply`, `set_min_burn`,
`set_note_fee`, `rbac_grant`, `rbac_revoke`, `set_attester`, `pause`,
`unpause`, `blocklist` -- see `src/lib/admin/roles.ts`), verify the full
lifecycle:

1. **Create** the proposal from the admin console.
2. **Sign** with enough signers to reach the faucet's multisig threshold.
3. **Execute** the proposal.
4. **Faucet consumes it** -- the consumption poller (`src/lib/admin/
   consumption.ts` / the pending-proposal UI) reaches the terminal `applied`
   state, not just `submitted`/`pending`.

Additional scenario checks (run once, against whichever actions naturally
exercise them):

- **Pause via a 1-of-N `DOM_PAUSER` multisig.** A multisig admin account
  where any single member holds `DOM_PAUSER` can pause the faucet with one
  signature -- confirm `pause` executes and applies with only one signer.
- **Unpause via a `DOM_UNPAUSER` majority.** Unlike pause, unpausing needs
  the multisig's normal signature threshold from members holding
  `DOM_UNPAUSER` -- confirm a single signature is *not* enough and the
  proposal only executes once threshold is met.
- **Unauthorized-role attempt is gated.** Attempt an action (e.g.
  `set_attester`) from an account that lacks the required role
  (`ATTEST_ADMIN`) and confirm the console blocks/greys out the action
  rather than allowing a doomed on-chain attempt (`src/lib/admin/roles.ts`'s
  `ACTION_ROLE` mapping, enforced in the admin UI).
- **Wrong-network account input is rejected.** Enter an account ID/address
  from a different network (e.g. testnet while the console is configured for
  devnet) into an admin form and confirm it is rejected client-side rather
  than silently accepted.
- **Browser-reload reconstruction.** Mid-flow (after creating a proposal,
  before it reaches `applied`), reload the browser tab and confirm the
  in-progress proposal state and its deterministic recipe reconstruct
  identically (byte-identical `TransactionRequest`, per ruling 4 in the task
  plan) rather than being lost or silently re-derived differently.
- **Second-signer reconstruction.** Have a second signer, on a separate
  browser/profile/device, open the same pending proposal and confirm they
  reconstruct and can sign the identical transaction bytes the first signer
  created (cross-signer determinism, not just same-browser persistence).
- **Last-ADMIN revoke is blocked.** Attempt an `rbac_revoke` of `ADMIN` that
  would leave the faucet with zero `ADMIN` members and confirm the
  guardrail in `src/lib/admin/guardrails.ts` blocks it (or, if the ADMIN
  member set could not be verified from the on-chain role scan, confirm the
  fallback typed-confirmation dialog appears instead of a silent allow).
