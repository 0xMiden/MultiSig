## Coordinator Frontend

The coordinator frontend is built with Next.js and connects to the multisig coordinator backend. This document focuses on the pieces you need to run and develop the UI locally.

## Prerequisites

- Node.js 18+
- pnpm, npm, yarn, or bun
- Access to a running coordinator backend (local or remote)

## Environment setup

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_COORDINATOR_API_URL=http://localhost:59059
NEXT_PUBLIC_MIDEN_NODE_ENDPOINT=https://rpc.testnet.miden.io:443
```

Additional environment options are documented in [ENV_CONFIG.md](./ENV_CONFIG.md).

## Install dependencies

```bash
pnpm install
# or
npm install
```

## Run the development server

```bash
pnpm dev
# or
npm run dev
```

Open <http://localhost:3000> to view the app. Changes in `src` hot-reload automatically.

## Available scripts

```bash
pnpm build     # Create a production build
pnpm start     # Serve the production build
pnpm lint      # Run lint checks
```

## Project structure

- `src/app` – Next.js app directory for routes and UI
- `src/services` – API clients and async thunks
- `src/interactions` – Wallet interactions and modal flows
- `src/contexts` – React context providers

## Troubleshooting

If the UI fails to reach the coordinator API, confirm the values in `.env.local` and ensure the backend is reachable from your machine.
