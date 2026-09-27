# Coordinator Frontend

Next.js application for creating and operating Miden multisig accounts through OpenZeppelin Guardian. The browser runs the Miden client locally and can sign with a local development key, Para, or the Miden Wallet extension.

## RC compatibility baseline

The RC versions are intentionally pinned because Guardian proposal serialization must match the Miden SDK version:

| Package group | Version |
| --- | --- |
| `@openzeppelin/guardian-client` | `0.18.0-rc.1` |
| `@openzeppelin/miden-multisig-client` | `0.18.0-rc.1` |
| `@miden-sdk/*` | `0.17.0-rc.3` |
| `@getpara/*` | `3.20.0` |

Do not independently upgrade the Miden SDK to `0.17.0-rc.4`: its transaction-request encoding is not compatible with Guardian `0.18.0-rc.1`.

This application is configured for Miden **devnet**. The legacy coordinator server in this repository is not used by this frontend flow.

## Prerequisites

- Node.js 20 or newer
- npm
- A Guardian `0.18.0-rc.1` endpoint configured for the same Miden devnet
- Optional: Miden Wallet browser extension or a Para API key

## Environment setup

Copy `.env.example` to `.env.local`, then provide the Guardian endpoint:

```bash
NEXT_PUBLIC_GUARDIAN_ENDPOINT=https://your-guardian.example
NEXT_PUBLIC_MIDEN_RPC_URL=devnet
NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL=devnet
NEXT_PUBLIC_MIDEN_REGISTRATION_CODE=guardian
```

| Variable | Description | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_GUARDIAN_ENDPOINT` | Required Guardian `0.18.0-rc.1` base URL | none |
| `NEXT_PUBLIC_MIDEN_RPC_URL` | Miden RPC URL or SDK network shorthand | `devnet` |
| `NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL` | Note transport URL or SDK network shorthand | `devnet` |
| `NEXT_PUBLIC_MIDEN_REGISTRATION_CODE` | Devnet account-registration invitation code | `guardian` |
| `NEXT_PUBLIC_PARA_API_KEY` | Enables Para signing | none |
| `NEXT_PUBLIC_PARA_ENVIRONMENT` | Para environment (`development` or `production`) | `development` |

The app deliberately has no fallback Guardian URL. This prevents an RC/devnet browser client from silently connecting to the previous public deployment.

## Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

Validation commands:

```bash
npm run typecheck
npm run lint
npm run build
```

## First run after this RC migration

Existing accounts and proposals from the previous network/serialization version are not migrated. Before creating the first RC account, clear this origin's browser site data once (IndexedDB, local storage, and cookies), then reload.

The SDK continues to own its existing `MidenClientDB` IndexedDB database. The application neither renames nor deletes it during startup. Signer keys remain in the separate `MultisigSignerKeys` database.

When a new multisig account is created, the app:

1. registers it with Guardian;
2. registers its note tag locally;
3. calls the devnet node's account-registration endpoint with the configured invitation code;
4. syncs until the initial funding note is available;
5. exposes that note in **Receive Funds**, where the normal multisig proposal/sign/execute flow deploys and funds the account.

Registration or funding-note discovery can be retried from the dashboard without recreating the account. The app never repeats proposal signing or execution automatically.

## Proposal actions

Proposal rows show `signed/required` directly. Actions are derived from Guardian verification state:

- **Sign** is shown only for an eligible signer who has not already signed.
- **Execute** is shown only when `isProposalActionable()` succeeds.
- transient verification failure receives one automatic sync retry, then exposes **Retry**;
- a non-retryable invalid proposal exposes **Create again** with editable values;
- completed proposals have no action.

## Key files

- `src/contexts/MultisigContext.tsx` — account, Guardian, proposal, signing, execution, and funding state
- `src/lib/multisigApi.ts` — Guardian/Miden client setup, node registration, and private-note transport
- `src/lib/proposalActions.ts` — centralized proposal action policy
- `src/lib/initClient.ts` — browser Miden client and local signer-key initialization
- `src/hooks/useMidenWallet.ts` — Miden Wallet extension adapter
- `src/hooks/useParaSession.ts` — Para signer integration
- `src/config/psm.ts` — runtime endpoint and network configuration

## Troubleshooting

- **Guardian connection fails:** confirm `NEXT_PUBLIC_GUARDIAN_ENDPOINT` points to Guardian `0.18.0-rc.1` on devnet. Restart Next.js after changing `.env.local`.
- **Old account or decoding errors:** clear this origin's site data, reload, and create a fresh RC account.
- **Funding note does not appear:** use **Retry funding**. Confirm the RPC is devnet and the invitation code is accepted by that node.
- **Miden Wallet does not connect:** confirm the extension is installed and unlocked, then reconnect using the app's wallet controls.
- **Para does not appear:** set `NEXT_PUBLIC_PARA_API_KEY` and restart the development server.
