## Coordinator Frontend

Next.js web application for managing Miden multisig accounts. Uses the [PSM SDK](https://docs.openzeppelin.com) (`@openzeppelin/miden-multisig-client`) for proposal coordination and a WASM-compiled Miden client (`@miden-sdk/miden-sdk`) running in the browser.

> [!NOTE]
> After v0.13.x testnet, the frontend only coordinates using [PSM](https://github.com/OpenZeppelin/private-state-manager.git). The coordinator server backend present in this repository is ignored even when running.

## Prerequisites

- Node.js 18+
- npm, pnpm, yarn, or bun

## Environment Setup

Create `.env.local` in the project root:

```bash
# Required
NEXT_PUBLIC_PSM_ENDPOINT=https://psm-stg.openzeppelin.com
NEXT_PUBLIC_MIDEN_RPC_URL=https://rpc.devnet.miden.io

# Para wallet support (optional — enables external EVM wallet signing)
NEXT_PUBLIC_PARA_API_KEY=<your-para-api-key>
NEXT_PUBLIC_PARA_ENVIRONMENT=development

# Coordinator server (optional — only needed if running the coordinator backend)
NEXT_PUBLIC_COORDINATOR_API_URL=http://localhost:59059
NEXT_PUBLIC_EXTERNAL_COORDINATOR_API_URL=http://localhost:59059
```

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_PSM_ENDPOINT` | PSM service URL | `https://psm-stg.openzeppelin.com` |
| `NEXT_PUBLIC_MIDEN_RPC_URL` | Miden node RPC endpoint | `https://rpc.devnet.miden.io` |
| `NEXT_PUBLIC_PARA_API_KEY` | Para wallet API key | _(empty — disabled)_ |
| `NEXT_PUBLIC_PARA_ENVIRONMENT` | Para environment (`development` / `production`) | `development` |

## Install Dependencies

```bash
npm install
```

## Run the Development Server

```bash
npm run dev
```

Open <http://localhost:3000> to view the app. Changes in `src/` hot-reload automatically.

## Available Scripts

```bash
npm run build     # Create a production build (standalone output)
npm run start     # Serve the production build
npm run lint      # Run lint checks
```

## Project Structure

```text
src/
├── app/                    # Next.js app router (pages and layouts)
│   ├── login/              # Account creation and loading flows
│   └── dashboard/          # Main dashboard (home, assets, transactions, settings)
├── components/             # Shared UI components (AppHeader, Providers)
├── contexts/               # MultisigContext — central state manager
├── hooks/                  # useParaSession, useMidenWallet
├── interactions/           # Modal flows (send, receive, sign, approve)
├── lib/                    # Core logic (initClient, multisigApi, procedures)
├── store/                  # Redux store (wallet form state)
├── types/                  # TypeScript type definitions
└── wallets/                # Wallet source types and abstractions
```

### Key Files

- **`src/contexts/MultisigContext.tsx`** — Central state manager. Initializes the WebClient and MultisigClient, manages account state, proposals, and signing operations.
- **`src/lib/initClient.ts`** — WebClient (WASM) and signer key initialization.
- **`src/lib/multisigApi.ts`** — MultisigClient creation and signer factory.
- **`src/config/psm.ts`** — PSM, Miden RPC, and Para configuration constants.
- **`src/hooks/useParaSession.ts`** — Para wallet connection and ECDSA key derivation.
- **`src/hooks/useMidenWallet.ts`** — Miden Wallet browser extension integration.

## Troubleshooting

- **WASM loading fails** — Ensure `public/miden_client_web.wasm` exists. The webpack config in `next.config.mjs` copies it to the required locations during build.
- **Para wallet not showing** — Verify `NEXT_PUBLIC_PARA_API_KEY` is set. The Para modal only renders when an API key is present.
- **State issues after upgrade** — The app clears IndexedDB (`MidenClientDB`) on initialization. If you see stale data, try clearing browser storage manually.
