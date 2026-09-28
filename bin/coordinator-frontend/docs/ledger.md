# Direct USB Ledger integration

The application uses Device Management Kit + WebHID + Ethereum Signer Kit.
It does **not** use Ledger Wallet Provider. No Ledger API key, app ID,
dAppIdentifier, originToken, or Ledger environment variables are required.
The existing Guardian, Miden RPC, registration and note-transport configuration
still applies. Ledger Live must release the USB device before the browser uses it.

## Using it

1. Use desktop Chrome or Edge on HTTPS or localhost. Connect Ledger by USB,
   unlock it and open its Ethereum app.
2. In the wallet dropdown choose **CONNECT LEDGER (USB)**, then **Choose USB device**.
3. Select an address. The address must be confirmed on the Ledger before it
   becomes the signing identity. Five addresses are shown per page.
4. Create an ECDSA multisig or explicitly load an existing compatible account.
   For another account's Add Signer flow, use **Copy signer commitment** in the
   dropdown. Receiving a note uses the Miden account ID, not the Ethereum address.
5. Approve Guardian authentication requests and transaction approvals as prompted.
   These are separate EIP-712 messages; one app action can need several approvals.

Layouts: Ledger Live uses `44'/60'/i'/0/0`; legacy uses `44'/60'/0'/0/i`.
The choice is explicit; discovery does not imply an address has funds.
Changing the address, changing wallet source, cancellation or disconnection
invalidates the signing session. Reconnect and reload explicitly. No device
private key is requested or stored; the selected Ledger identity is held in memory.
Reload does not automatically prompt the device or fall back to software keys.
Cancellation cannot undo a transaction already submitted to the network.

## What is signed

The pinned Guardian SDK's `Eip712Signer` validates address/public-key correspondence,
normalizes the secp256k1 public key and derives its Miden commitment through Miden
WASM. Do not substitute Keccak(address), a generic hash, or a hash of displayed hex.
A public key deterministically produces a commitment; the commitment cannot be
reversed into a public key. The Add Signer field remains explicitly a commitment
field, avoiding guesses about arbitrary 32-byte input.

The bridge accepts only these protocol schemas (version `1`):

| Domain | Primary type | Message |
| --- | --- | --- |
| Miden Transaction | MidenTransaction | txSummaryHash: bytes32 |
| Guardian Request | GuardianRequest | requestHash: bytes32 |
| Guardian Lookup | GuardianLookup | lookupHash: bytes32 |

The SDK constructs the exact payload, including hashing the transaction summary
or timestamp-bound authentication data. The bridge serializes prompts, enforces
the selected address/path, normalizes the signature recovery byte, and rejects
results from invalidated sessions. Authentication queued more than 30 seconds is
rejected for an explicit retry rather than silently signing an old request.

The local context module supplies no remote descriptors or telemetry. In the
pinned Ledger SDK, an unavailable typed-data filter selects basic EIP-712 signing.
This is **summary-hash signing**, not certified clear signing of recipient/amount.
Review transaction details in the app. Device firmware/app settings, including
any requirement to enable blind signing, must be validated on the physical device.
Nano X was used in the teammate's earlier demo; compatibility of this implementation
with any particular model/firmware is not yet certified.

## Automated checks

From `bin/coordinator-frontend` (Node 20.19+):

```sh
npm ci
npm run test:ledger
npx playwright install chromium
npm run test:ledger:ui
npm run typecheck
npm run build
npm run test:ledger:app
```

`test:ledger` uses real Miden WASM, the real Guardian signer and independent viem
signatures. It checks commitment derivation, all three typed-data domains,
wrong-key/address failures, queue invalidation, recovery IDs, signer selection,
and simulated SDK observable cancellation/rejection/timeout.

`test:ledger:ui` runs the production hook and dialog in Chromium. Only the USB
device module is replaced by a test-only Vite alias. It checks pagination, layouts,
confirmation rejection/retry, signing, unplug, Escape and address changes.
The fake device and its known disposable keys are not imported by production code.
An existing compatible Chromium executable may be specified with
`LEDGER_TEST_BROWSER=/absolute/path/to/chromium`.

`test:ledger:app` smoke-tests the built production application and actual Ledger
SDK loading, with no device mocks or device selection. It does not perform signing.

## Real Guardian/Miden integration suite

```sh
export LEDGER_TEST_RPC_URL='http://localhost:57291'
export LEDGER_TEST_GUARDIAN_URL='http://localhost:3000'
export LEDGER_TEST_TRANSPORT_URL='http://localhost:50051'
export LEDGER_TEST_INVITATION_CODE='your-test-invitation'
npm run test:ledger:services
```

These example ports must be replaced with your actual service endpoints. Supply
mutually compatible Miden 0.17 / Guardian 0.18 RC services with browser CORS enabled,
an ECDSA Guardian key, note transport, and registration funding in the native fee
asset. The suite creates a fresh disposable account using public, deterministic
test keys. **Use an isolated test network; these keys are not secure wallets.**
Registration must fund enough for transfers and fees. On an open local network
where registration does not fund, fund the printed account ID while the runner
waits for its first note (three-minute deadline). `LEDGER_TEST_SEND_AMOUNT` sets
each self-transfer in base units (default 10000).

The suite exercises creation/Guardian registration, loading, authenticated lookup,
funding-note consumption, public and private self-transfers and consumption,
adding a second signer, changing the threshold, rejecting execution below the
threshold, and executing with both signatures. It checks the local commitment
against the node after each execution and reads signer/threshold state from the
account store. It does not treat a proposal merely reaching `ready` as execution.
Missing service configuration fails explicitly. The physical signing device is
simulated here, while Guardian, RPC, WASM execution, proof submission and transport
are real. The suite is implemented but has not been executed against services in
this workspace; the old root Docker Compose setup is not a compatible fixture.

## Physical-device acceptance

Run the app with test services and record device model, firmware, Ethereum app
version, browser and OS. Verify:

- USB discovery, both address layouts, pagination, and on-device address matching.
- Create and reload an ECDSA multisig using the selected commitment.
- Authenticate Guardian requests and sign/execute a transaction summary.
- Receive/consume notes, public/private send, add signer and change threshold.
- Reject address/signature approval; retry deliberately.
- Unplug or cancel during signing; queued requests fail and no software signer is used.
- Change addresses, reload and confirm the old session cannot sign.
- Inspect network traffic for absence of Ledger context-service requests.

Automated tests do not certify USB transport, device display/firmware behavior,
or the no-credentials configuration on physical hardware. Those checks remain
required before treating hardware support as validated.
