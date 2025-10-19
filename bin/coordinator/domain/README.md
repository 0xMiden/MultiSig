# domain

Core data structures used throughout the multisig coordinator.

## overview

This crate defines the domain models that represent multisig accounts, transactions, and signatures. These structs are shared across the coordinator's engine, server, and persistence layers.

## main types

- **`MultisigAccount`** - Multisig account representation with type-state pattern for optional approvers and public key commits
- **`MultisigTx`** - Transaction request and summary with status tracking
- **`MultisigApprover`** - Approver account with public key commitment
- **`MultisigSignature`** - Signature submitted by an approver for a transaction
- **`Timestamps`** - Metadata for creation and update timestamps

## feature gates

- `serde` - Optional serde serialization/deserialization support
