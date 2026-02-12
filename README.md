# Miden Multisig

Multi-signature account management on the [Miden](https://miden.io) network. Multiple parties collectively control an account, requiring a configurable threshold of signatures to execute transactions.

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

The frontend supports three wallet sources for signing:

| Source | Scheme | Description |
|--------|--------|-------------|
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
