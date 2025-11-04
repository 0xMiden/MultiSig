# Miden Multisig

This repository provides the infrastructure for managing multi-signature accounts on the Miden network. It houses three main components:

- **miden-multisig-coordinator**: A backend coordinator server that manages multisig accounts, transaction proposals, and signature collection
- **coordinator-frontend**: A Next.js web frontend for interacting with the multisig coordinator
- **miden-multisig-client**: Client libraries for interacting with multisig accounts and the coordinator service

## Status

This project is under **active development**. The APIs, data structures, and workflows are subject to change. **Expect breaking changes** as we iterate on the design and implementation.

## Overview

The Miden MultiSig system enables multiple parties to collectively control an account, requiring a threshold of signatures to execute transactions. The coordinator server acts as a central point for:

- Creating and managing multisig accounts
- Coordinating transaction proposals
- Collecting and verifying signatures from approvers
- Executing transactions once the signature threshold is met

## Workspace Structure

```text
.
├── bin/
│   ├── coordinator-frontend/   # Web frontend application
│   └── coordinator-server/     # Coordinator server binary and configuration
├── crates/
│   ├── coordinator/
│   │   ├── domain/             # Core domain models and types
│   │   ├── engine/             # Business logic and multisig engine
│   │   ├── store/              # Database layer and persistence
│   │   └── utils/              # Shared utilities
│   └── miden-multisig-client/  # Client library for multisig operations
├── Dockerfile.coordinator            # Docker image for coordinator server
├── Dockerfile.coordinator-frontend   # Docker image for frontend
└── docker-compose.yml                # Docker compose setup (frontend + server + PostgreSQL)
```

## Quick Start with Docker

For local development and testing, you can quickly spin up the entire stack (frontend, coordinator server, and PostgreSQL) using make targets:

### Start the Coordinator Server + Frontend application

```bash
make docker-run-coordinator
```

This will:

- Build the Docker images for the frontend and coordinator server
- Start PostgreSQL database with the required schema (see [migrations](crates/coordinator/store/migrations))
- Start the coordinator server listening on `http://localhost:59059`
- Start the frontend web application at `http://localhost:3000`

The server exposes a REST API for multisig operations and includes a `/health` endpoint for monitoring. The frontend provides a user-friendly interface for managing multisig accounts and transactions.

### Stop All Services

```bash
make docker-stop-coordinator
```

This will stop and remove all containers. Note that the multisig client store and the PostgreSQL database are ephemeral (no persistent volumes), so all data will be lost when containers are stopped.

### Configuration

The coordinator server is configured via environment variables in `docker-compose.yml`. Key settings include:

- **Application**: Listen address, network ID
- **Database**: PostgreSQL connection string and pool settings
- **Miden**: Node RPC URL, store path, keystore path

For detailed configuration options, see `bin/coordinator-server/src/base_config.ron` and the environment variables in `docker-compose.yml`.

## License

This project is [MIT licensed](LICENSE).
