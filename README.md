# Miden Multisig

Multi-signature account management on the [Miden](https://miden.io) network. Multiple parties collectively control an account, requiring a configurable threshold of signatures to execute transactions.

## Ledger integration: setup, testing and code

This branch integrates Ledger **directly over USB**, using WebHID and the Ledger
Ethereum app to sign EIP-712 messages. It does not use Ledger Wallet Provider:
no Ledger API key, app ID, `dAppIdentifier` or `originToken` is needed. Para
credentials and the Miden Wallet extension are also unnecessary for this path.

### Run the branch

Prerequisites: Node.js **20.19+**, npm, desktop **Chrome or Edge**, a USB data
cable, and a Ledger with its Ethereum app installed. Use localhost or HTTPS;
Safari, Firefox and mobile USB are not supported by this implementation. Use a
separate browser profile and disposable devnet accounts for testing.

From the repository root:

```bash
git switch ledger-integration
cd bin/coordinator-frontend
npm ci
# Only if you do not already have .env.local:
cp .env.example .env.local
```

Edit `.env.local` before starting the app:

```dotenv
NEXT_PUBLIC_GUARDIAN_ENDPOINT=https://your-guardian.example
NEXT_PUBLIC_MIDEN_RPC_URL=devnet
NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL=devnet
NEXT_PUBLIC_MIDEN_REGISTRATION_CODE=guardian
```

Replace the Guardian placeholder with a reachable **0.18.0-rc.2** instance with
ECDSA support, configured for the same Miden devnet. Use the registration code
accepted by that deployment. The pinned Miden SDK is **0.17.0-rc.4**; keep the
lockfile versions together. The root Docker Compose stack is the legacy
coordinator setup, not a compatible Guardian test fixture.

```bash
npm run dev
```

Open <http://localhost:3000>. Restart the dev server after environment changes.
A Ledger provides signatures; working Guardian/RPC/note-transport services and
test funding are still required to execute the account flows.

### Connect your Ledger

1. Connect by USB, unlock the device, and open its **Ethereum app**. Close Ledger
   Live and other apps/tabs holding the device connection.
2. Open the app header's wallet dropdown → **CONNECT LEDGER (USB)** →
   **Choose USB device**. Select the device in the browser permission dialog.
3. Choose an address layout. **Ledger Live accounts** uses `44'/60'/i'/0/0`;
   **Legacy / sequential addresses** uses `44'/60'/0'/0/i`. The app shows five
   derived addresses at a time; **Load more addresses** fetches the next five.
4. Choose an address and **confirm it on the physical Ledger**. The header should
   show **LEDGER ●**. The wallet dropdown displays the chosen Ethereum address
   and offers **Copy signer commitment**.
5. Create an **ECDSA** multisig or load one that already authorizes this Ledger's
   commitment. Use the copied commitment when adding this Ledger as a signer.
   The Ethereum address is not the Miden account ID or the signer commitment.

The device signs a **transaction-summary hash**, not decoded recipient/amount
fields. Review those details in the app before approving. If the Ethereum app
requires blind signing for these approvals, enable it only when intentionally
testing this flow and record the setting with your results. Physical-device
compatibility still needs validation; the teammate's earlier demo used a Nano X.

### Hardware test checklist

Start with a fresh **1-of-1 ECDSA** account. Save its Miden account ID and the
selected Ledger derivation path so you can reconnect to the same signer.

| Test | Actions | Expected result |
| --- | --- | --- |
| Account creation | Connect Ledger, create the account, approve Guardian authentication prompts. | Created account contains the selected Ledger commitment. |
| Receive funds | Wait for the registration funding note, or use Retry funding. In Receive Funds, create a consume-notes proposal, Sign, then Execute. | Ledger approves the required signatures; the note is consumed and balance updates after confirmation. |
| Sync authentication | Click Sync with Ethereum open. Repeat and reject an authentication prompt. | Signed Guardian reads prompt on Ledger. Rejection fails the request without using local, Para or extension keys. Previously displayed data may remain visible. |
| Send funds | Send a small public note to a second test Miden account; Sign and Execute. Repeat with a private note. | Ledger approves both transactions. Recipient discovers/consumes each note; private delivery requires working note transport. |
| Add signer | Add a second test signer's commitment, retaining threshold 1 initially. Sign and Execute. | Updated account state includes the new signer. |
| Change threshold | With access to both signers, change threshold to 2; Sign and Execute under the old threshold. Create another proposal. | Account becomes 2-of-2; the next proposal requires both distinct signatures before execution. |
| Load account | Reload the page, reconnect to the same Ledger address, and Load Existing Account using the saved Miden ID. | Authentication and later transaction signatures still use Ledger. |
| Reject/cancel/unplug | Reject address confirmation; reject a signature; unplug during a prompt; reconnect and retry explicitly. | Unconfirmed addresses are not selected. Invalidated sessions cannot sign; no software-key fallback occurs. |
| Change address | Use Change Ledger Address and select another address. | Old account session clears; explicitly load an account authorizing the new commitment. |

**While Ledger is the selected wallet source, every signature requested from
that signer goes through Ledger, including Guardian authentication during sync.**
Plain Miden chain reads do not require signing. The Guardian's own co-signature
is still generated by Guardian. Merely leaving USB plugged in does not force
Ledger if you deliberately select a different wallet source.

Expect several sequential device approvals for some actions: authentication and
transaction approval are separate messages. Keep the device unlocked and respond
to each prompt. Cancel/disconnect invalidates the signing session; reconnect and
reload explicitly. It cannot undo a transaction already submitted to the network.

### Automated testing

Run these commands from `bin/coordinator-frontend`:

```bash
npm run test:ledger
npx playwright install chromium
npm run test:ledger:ui
npm run typecheck
npm run build
npm run test:ledger:app
```

| Command | What it checks |
| --- | --- |
| `test:ledger` | Real Miden commitment derivation and EIP-712 signatures with a simulated Ledger; Guardian sync authentication, wrong-key/address rejection, cancellation and no software fallback. |
| `test:ledger:ui` | Production hook/dialog with a test-only device: address pagination/layouts, confirmation rejection/retry, signing, disconnect and address changes. |
| `test:ledger:app` | Built production app opens the Ledger dialog and loads the real USB SDK; no physical device selection or signing. |
| `test:ledger:services` | Real Guardian/Miden/transport execution with a simulated Ledger: create/load, receive, public/private send, add signer, threshold change and threshold enforcement. Requires separate service configuration below. |

The last verified software suite had **21 passing tests**, plus **5 browser tests**
and **1 production-app smoke test**. TypeScript and the production build passed.
**Physical Ledger signing and the real-service execution suite remain unverified.**
Automated simulated-device tests are not evidence that hardware signing works.

To run the real-service suite, provide actual compatible test-service endpoints:

```bash
export LEDGER_TEST_RPC_URL='http://localhost:57291'
export LEDGER_TEST_GUARDIAN_URL='http://localhost:3000'
export LEDGER_TEST_TRANSPORT_URL='http://localhost:50051'
export LEDGER_TEST_INVITATION_CODE='your-test-invitation'
npm run test:ledger:services
```

These ports are examples, not services started by the test command. Services
must allow browser requests and fund account registration with enough native
assets for transfers and fees. On an open local network without automatic
registration funding, fund the account ID printed by the runner during its
three-minute wait. The runner uses **public deterministic test keys**, so use
only disposable test funds. It checks on-chain state after execution, rather
than counting a proposal reaching `ready` as success. See the
[detailed service-test guide](bin/coordinator-frontend/docs/ledger.md#real-guardianmiden-integration-suite)
for additional options.

### How the code works

```text
Connect Ledger → choose path/address → confirm address on device
             → validate public key/address → derive Miden signer commitment
             → create/load multisig with the Ledger-backed Eip712Signer

Transaction approval / signed Guardian request
             → Eip712Signer builds the protocol EIP-712 object
             → DirectLedgerAdapter checks schema/address and queues the request
             → Ethereum Signer Kit → WebHID → Ledger confirmation/signature
             → SDK verifies signature → Guardian / multisig execution flow
```

The SDK derives the commitment from the normalized secp256k1 public key using
Miden WASM. Do not hash the Ethereum address or the displayed hex yourself.
Public key → commitment is deterministic; commitment → public key is not
reversible. Add Signer explicitly accepts a commitment rather than guessing what
an arbitrary hex string represents.

The adapter accepts only three EIP-712 schemas, all with domain version `1`:

| Primary type | Domain | Signed message field |
| --- | --- | --- |
| `MidenTransaction` | `Miden Transaction` | `txSummaryHash: bytes32` |
| `GuardianRequest` | `Guardian Request` | `requestHash: bytes32` |
| `GuardianLookup` | `Guardian Lookup` | `lookupHash: bytes32` |

Guardian's SDK constructs these payloads, including timestamp-bound authentication
hashes. Prompts are serialized, the selected path is fixed for the session, and
invalidated sessions reject pending results. Authentication queued longer than
30 seconds fails for an explicit retry. The Ledger context module supplies no
remote clear-signing descriptors, so this path needs no Ledger service credentials.

| File | Responsibility |
| --- | --- |
| [device.ts](bin/coordinator-frontend/src/lib/ledger/device.ts) | Real USB discovery/session, Ethereum Signer Kit, local context module, SDK action completion/cancellation/timeouts. |
| [adapter.ts](bin/coordinator-frontend/src/lib/ledger/adapter.ts) | EIP-1193 bridge accepting `eth_signTypedData_v4`, schema/address checks, prompt queue, session invalidation and signature normalization. |
| [useLedgerSession.ts](bin/coordinator-frontend/src/hooks/useLedgerSession.ts) | Address pagination/layouts, on-device confirmation, selected signer and connection lifecycle. |
| [LedgerPanel.tsx](bin/coordinator-frontend/src/components/LedgerPanel.tsx) | Connection dialog, address picker and signing/cancellation status. |
| [multisigApi.ts](bin/coordinator-frontend/src/lib/multisigApi.ts) | Returns the selected Ledger signer for ECDSA; missing Ledger sessions fail instead of falling back to local keys. |
| [MultisigContext.tsx](bin/coordinator-frontend/src/contexts/MultisigContext.tsx) | Binds the Ledger signer to create/load and shared account/proposal/sync operations; clears stale account sessions on wallet changes. |
| [tests/ledger](bin/coordinator-frontend/tests/ledger) | Cryptographic, simulated-device, browser, production-app and live-service test runners. |

### Troubleshooting and sharing results

- **USB unavailable:** use Chrome/Edge on localhost or HTTPS and check WebHID
  policy. **Device busy/missing:** check cable, unlock/open Ethereum, close Ledger
  Live and other sessions, then close/reopen the connection dialog.
- **Unexpected address:** compare the layout and path; confirm on-device.
- **Authentication timeout:** check the computer clock, keep Ledger ready and
  explicitly retry the app action. Do not expect a fallback signature.
- **No funds / transaction pending:** check registration funding and that Guardian,
  RPC and note transport use the same network; then retry funding or manually sync.

Report the commit (`git rev-parse HEAD`), device model/firmware/Ethereum app
version, browser/OS, layout/path, action, exact error and blind-signing setting.
Share sanitized logs only—never recovery phrases, PINs, private keys, credentials
or complete signed authentication headers. More detail is available in the
[frontend README](bin/coordinator-frontend/README.md#ledger-hardware-testing-on-this-branch)
and [integration guide](bin/coordinator-frontend/docs/ledger.md).

## Status

This project is under **active development**. The APIs, data structures, and workflows are subject to change. **Expect breaking changes** as we iterate on the design and implementation.

## Architecture

The frontend communicates directly with the [PSM (Private State Manager)](https://docs.openzeppelin.com) SDK for proposal coordination and state synchronization. The coordinator server is available as an optional backend for deployments that need centralized API access or audit trails.

```text
Frontend (Next.js + WASM)
  ├── WebClient (@miden-sdk/miden-sdk)  ──────►  Miden RPC Node
  ├── MultisigClient (@openzeppelin/miden-multisig-client)  ──►  PSM Endpoint
  └── Para Wallet (@getpara/react-sdk-lite)  ──►  External ECDSA wallets

Coordinator Server (Rust/Axum) [optional]
  ├── MultisigEngine  ──►  Miden RPC Node
  └── MultisigStore   ──►  PostgreSQL
```

### Components

- **coordinator-frontend** — Next.js web application. Runs a WASM-compiled Miden client in the browser, connects to PSM for proposal coordination, and supports multiple wallet types for signing.
- **coordinator-server** — Rust/Axum HTTP server that wraps the multisig engine. Provides a REST API for account creation, transaction proposals, and signature collection. See [`bin/coordinator-server/README.md`](bin/coordinator-server/README.md) for the full API reference.
- **miden-multisig-client** — Rust client library for multisig operations, used by the coordinator engine.

### Wallet Support

The frontend supports four wallet sources for signing:

| Source | Scheme | Description |
|--------|--------|-------------|
| **Ledger USB** | ECDSA / EIP-712 | Direct WebHID connection; user selects and confirms an address |
| **Local keys** | Falcon / ECDSA | Browser-generated keys stored in IndexedDB |
| **[Para](https://getpara.com)** | ECDSA | External EVM wallets (MetaMask, etc.) via Para SDK |
| **[Miden Wallet](https://github.com/demox-labs/miden-wallet)** | Falcon / ECDSA | Miden Wallet browser extension |

## Workspace Structure

```text
.
├── bin/
│   ├── coordinator-frontend/   # Next.js web frontend (PSM SDK + WASM)
│   └── coordinator-server/     # Rust coordinator server (Axum + PostgreSQL)
├── crates/
│   ├── coordinator/
│   │   ├── domain/             # Core domain models and types
│   │   ├── engine/             # Business logic and multisig engine
│   │   ├── store/              # PostgreSQL persistence (Diesel ORM)
│   │   └── utils/              # Shared utilities
│   └── miden-multisig-client/  # Rust client library for multisig operations
├── Dockerfile.coordinator            # Docker image for coordinator server
├── Dockerfile.coordinator-frontend   # Docker image for frontend
└── docker-compose.yml                # Full stack: frontend + server + PostgreSQL
```

## Quick Start with Docker

Spin up the full stack (frontend, coordinator server, and PostgreSQL) locally:

```bash
make docker-run-coordinator
```

This builds the Docker images and starts:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | `http://localhost:3000` | Web UI |
| Coordinator Server | `http://localhost:59059` | REST API (+ `/health` endpoint) |
| PostgreSQL | `localhost:5432` | Database |

To stop and remove all containers:

```bash
make docker-stop-coordinator
```

> **Note:** The PostgreSQL database is ephemeral (no persistent volumes). All data is lost when containers stop.

## Configuration

### Frontend Environment Variables

The frontend is configured via `NEXT_PUBLIC_*` environment variables, set at build time. In Docker, these are defined in the `frontend` service in `docker-compose.yml`.

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_PSM_ENDPOINT` | PSM service URL for proposal coordination | `https://psm-stg.openzeppelin.com` |
| `NEXT_PUBLIC_MIDEN_RPC_URL` | Miden node RPC endpoint | `https://rpc.devnet.miden.io` |
| `NEXT_PUBLIC_PARA_API_KEY` | [Para](https://getpara.com) wallet API key (enables Para wallet support) | _(empty — Para disabled)_ |
| `NEXT_PUBLIC_PARA_ENVIRONMENT` | Para environment (`development` or `production`) | `development` |
| `NEXT_PUBLIC_COORDINATOR_API_URL` | Coordinator server URL (internal, for server-side requests) | — |
| `NEXT_PUBLIC_EXTERNAL_COORDINATOR_API_URL` | Coordinator server URL (external, for browser requests) | — |

> `VITE_PARA_API_KEY` is also accepted as a compatibility alias for `NEXT_PUBLIC_PARA_API_KEY`.

### Coordinator Server Environment Variables

The server reads `bin/coordinator-server/src/base_config.ron` as defaults and overrides values with environment variables prefixed `MIDENMULTISIG_`. Use `__` for nested keys.

| Variable | Description | Default |
|----------|-------------|---------|
| `MIDENMULTISIG_APP__LISTEN` | Server bind address | `localhost:59059` |
| `MIDENMULTISIG_APP__NETWORK_ID_HRP` | Bech32 human-readable prefix | `mtst` |
| `MIDENMULTISIG_APP__CORS_ALLOWED_ORIGINS` | JSON array of allowed origins | `["*"]` |
| `MIDENMULTISIG_DB__DB_URL` | PostgreSQL connection string | `postgres://multisig:multisig_password@localhost:5432/multisig` |
| `MIDENMULTISIG_DB__MAX_CONN` | Connection pool size | `10` |
| `MIDENMULTISIG_MIDEN__NODE_URL` | Miden node RPC URL | `https://rpc.testnet.miden.io:443` |
| `MIDENMULTISIG_MIDEN__STORE_PATH` | Local Miden client store path | `./store` |
| `MIDENMULTISIG_MIDEN__KEYSTORE_PATH` | Keystore directory path | `./keystore` |
| `MIDENMULTISIG_MIDEN__TIMEOUT` | Request timeout | `30s` |
| `RUST_LOG` | Log level (`debug`, `info`, `warn`, `error`) | `info` |

For full server configuration details, see [`bin/coordinator-server/README.md`](bin/coordinator-server/README.md).

## Local Development

### Prerequisites

- **Rust** 1.90+ (see [`rust-toolchain.toml`](rust-toolchain.toml))
- **Node.js** 18+
- **PostgreSQL** 13+ (or use Docker)
- **Docker** (for containerized setup)

### Development Tools

```bash
# Check which tools are installed
make check-tools

# Install all required dev tools (typos, nextest, taplo, machete)
make install-tools
```

### Frontend

```bash
cd bin/coordinator-frontend
npm install
npm run dev
# → http://localhost:3000
```

Create a `.env.local` file for local development:

```bash
NEXT_PUBLIC_PSM_ENDPOINT=https://psm-stg.openzeppelin.com
NEXT_PUBLIC_MIDEN_RPC_URL=https://rpc.devnet.miden.io
NEXT_PUBLIC_PARA_API_KEY=<your-para-api-key>
NEXT_PUBLIC_PARA_ENVIRONMENT=development
```

### Server

See the [database migrations section](crates/coordinator/store/README.md#database-migrations) for PostgreSQL setup, then:

```bash
cargo run --release --bin miden-multisig-coordinator-server
```

### Common Make Targets

```bash
make build           # Build all Rust crates (release)
make test            # Run tests
make lint            # Run all linters (clippy, fmt, taplo, typos, machete)
make check           # Check all targets for errors
```

## License

This project is [MIT licensed](LICENSE).
