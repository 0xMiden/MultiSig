# Coordinator Frontend

Next.js application for creating and operating Miden multisig accounts through OpenZeppelin Guardian. The browser runs the Miden client locally and can sign with a local development key, Para, the Bread extension, or a Ledger over direct USB.

## Compatibility baseline

The versions are pinned together because Guardian proposal serialization must match the Miden SDK version:

| Package group | Version |
| --- | --- |
| `@openzeppelin/guardian-client` | `0.18.1` |
| `@openzeppelin/miden-multisig-client` | `0.18.1` (0.18.0 clients refuse proposals made by 0.18.1 ones: every app on a Guardian must move together) |
| `@miden-sdk/miden-sdk` | `0.17.3`, forced for every package via `overrides` (one SDK copy: the app and the multisig client share WASM objects); `miden-multisig-client` 0.18.1 depends on 0.17.3 too. 0.17.1+ fixes consuming/sending V2 faucet assets such as testnet USDCX ("procedure root could not be found"). `tests/ledger/procedure-roots.test.ts` checks the client's hard-coded procedure roots still match. |
| other `@miden-sdk/*` | `0.17.3` |
| `@getpara/*` | `3.20.0` |

Keep the installed versions in `package-lock.json` together; do not independently upgrade the Miden or Guardian packages.

This application runs on Miden **testnet** in production (devnet also works) and communicates directly with Guardian.

## Prerequisites

- Node.js 20.19 or newer
- npm
- A Guardian `0.18` endpoint on the same Miden network (testnet: `https://guardian-testnet.openzeppelin.com`)
- Optional: Bread browser extension or a Para API key

## Environment setup

Copy `.env.example` to `.env.local`, then provide the Guardian endpoint:

```bash
NEXT_PUBLIC_GUARDIAN_ENDPOINT=https://your-guardian.example
NEXT_PUBLIC_MIDEN_NETWORK=testnet
NEXT_PUBLIC_MIDEN_RPC_URL=https://rpc.testnet.miden.io
NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL=https://transport.miden.io
NEXT_PUBLIC_MIDEN_REGISTRATION_CODE=guardian
```

| Variable | Description | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_GUARDIAN_ENDPOINT` | Required Guardian `0.18` base URL | none |
| `NEXT_PUBLIC_GUARDIAN_ENDPOINTS` | Other Guardians users may switch to at runtime, full URLs, comma-separated. With the default, the only Guardians users can switch to; the security policy also admits the app's own origin and any `NEXT_PUBLIC_CSP_CONNECT_SRC` origin | none |
| `NEXT_PUBLIC_MIDEN_NETWORK` | Network name: `devnet`, `testnet`, `mainnet`, `local` or `custom` (wallet network, address prefix, invitation-code rule) | none (required) |
| `NEXT_PUBLIC_MIDEN_RPC_URL` | Full Miden RPC URL, e.g. `https://rpc.testnet.miden.io` | none (required) |
| `NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL` | Full note transport URL, e.g. `https://transport.miden.io` | none (required) |
| `NEXT_PUBLIC_MIDEN_PROVER_URL` | Full remote prover URL, or `local` to prove in the browser | `local` |
| `NEXT_PUBLIC_MIDEN_REGISTRATION_CODE` | Default registration invitation code on devnet, local and custom networks (testnet pre-fills `00000`; mainnet requires the creator's code) | `guardian` |
| `NEXT_PUBLIC_PARA_API_KEY` | Enables Para signing | none |
| `NEXT_PUBLIC_PARA_ENVIRONMENT` | Para environment matching the key: `sandbox`, `beta` (for `beta_…` keys), `production`, or `development` (Para's local stack) | `development` |

The app has no built-in network endpoints: RPC, note transport and prover come from these variables as plain `http(s)` origins such as `https://rpc.testnet.miden.io`, with no path, query or credentials (SDK shorthands such as `testnet` are rejected), and a missing or invalid value stops the app at start-up with a message naming the variable. Likewise there is no fallback Guardian URL. This prevents an RC/devnet browser client from silently connecting to the previous public deployment.

## Install and run

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>.

Validation commands:

```bash
npm run typecheck
npx eslint src
npm run build
```

## Ledger hardware testing on this branch

This is the **direct USB** integration: browser → WebHID → Ledger Ethereum app.
There is no Wallet Provider login, Ledger API key, app ID, `dAppIdentifier` or
`originToken` to configure. Para credentials and the Bread extension are
not required for Ledger testing.

### Prepare and connect

1. Check out `ledger-integration` with these changes, then run the install/run
   commands above from `bin/coordinator-frontend`. If `.env.local` does not exist,
   copy `.env.example` to `.env.local`. Set a reachable Guardian **0.18**
   endpoint with ECDSA support on the same Miden network as the app. Restart the
   dev server after environment changes. The root Docker Compose stack starts
   only the frontend; Guardian and Miden services must be provided separately.
2. Open `http://localhost:3000` in desktop **Chrome or Edge**, preferably in a
   dedicated test profile. Remote deployments require HTTPS. Use a USB data
   cable, unlock Ledger, open its **Ethereum app**, and close Ledger Live or
   other tabs/apps that are using the device. The teammate's earlier demo used
   Nano X; this implementation still needs physical-device validation.
3. Open the wallet dropdown in the header → **CONNECT LEDGER (USB)** →
   **Choose USB device**. Select your device in the browser's permission dialog.
4. Choose the address layout and an address. **Ledger Live accounts** uses
   `44'/60'/i'/0/0`; **Legacy / sequential addresses** uses `44'/60'/0'/0/i`.
   **Load more addresses** shows the next five. These are derived addresses,
   not a balance scan. Confirm the chosen address on the physical Ledger.
5. Check that the header shows **LEDGER ●**. The dropdown shows the chosen
   Ethereum address; **Copy signer commitment** copies the derived Miden
   commitment for use in account creation or Add Signer. Never paste the
   Ethereum address into a Miden recipient or signer-commitment field.

### What to expect when signing (including Sync)

While **Ledger is the selected wallet source**, all user-signature requests use
that selected Ledger address and derivation path. Without a Guardian session
(below), this includes authenticated Guardian reads during **Sync**, proposal
signing, account registration/loading, and lookup when invoked: Guardian state
sync calls the SDK's `signRequest`, which routes through the Ledger adapter as an
EIP-712 `GuardianRequest`.
Transaction approval uses `MidenTransaction`; lookup uses `GuardianLookup`.
Ordinary Miden chain reads do not require a signature, so not every sync step
will display a device prompt. The Guardian's own co-signature remains its own.

One UI action may require several approvals, shown **one at a time**. Keep the
Ledger unlocked with its Ethereum app open and follow each on-screen prompt.

**Guardian session (Guardian 0.18.1).** Loading an account starts one before
the load's own Guardian requests (creating an account, right after Guardian
registers it; Guardian grants sessions only to a cosigner of some account). The
app first shows the grant (signer, session key, website, validity, scope,
Guardian key, network), then the wallet signs it: one `GuardianSession`
approval on the Ledger. The device shows its fields only with the Ethereum app's
raw-message / verbose EIP-712 display; with blind signing it shows a hash, so
check the app's dialog. From then on Guardian reads and proposal list, get,
create and sign requests are signed by a key the browser keeps (non-extractable),
so they stop prompting; approving a transaction summary, executing, unlocking,
registering and lookup still ask the Ledger. The session lasts Guardian's
maximum less a minute (7 h 59 min by default). A reload resumes it before the
account loads, without a prompt. Another wallet or Guardian, disconnecting the
wallet, or logout ends it on Guardian; logout first deletes the stored keys, so
a revoke Guardian never receives leaves no usable key. A request that finds the
session ended elsewhere is retried once with the wallet. Without a session
(declined, expired, or a Guardian without sessions), the private-note check
before every proposal, sign, execute, offline sign or import reads the account's
latest transaction from Guardian: one extra approval, two when that transaction
has a private note, and one more on an account with transactions from before
Guardian 0.18.1. The signer chip shows the session and offers
**Start session** when there is none.

The device signs a transaction-summary **hash**; recipient and amount must be
reviewed in the app, not expected as decoded transaction fields on the Ledger.
If the Ethereum app requires blind signing, enable it on the device only when
intentionally testing these summary-hash approvals; record that setting in your
results. There is no fallback to `personal_sign` or a software key.

Rejecting/cancelling a device request fails that request. Disconnecting, changing
addresses or cancelling the signing session invalidates it; reconnect and
explicitly load the Miden account again. Reloading the page also requires
reconnection. Selecting another wallet source deliberately changes who signs;
merely leaving the USB cable plugged in does not force Ledger after that switch.
An already-submitted transaction cannot be undone by cancelling the device UI.

### End-to-end checklist

Use disposable devnet accounts and test funds. Start with a **1-of-1 ECDSA**
account so a missing second signer does not block execution. Ledger cannot sign
for a Falcon account or an account that does not authorize its commitment.

| Step | Action | Expected result |
| --- | --- | --- |
| Create | With Ledger selected, create a multisig and approve Guardian prompts. | Account stores the selected Ledger commitment; save its Miden account ID. |
| Receive | Wait for registration funding or use Retry funding. In Receive Funds, create a consume-notes proposal, Sign, then Execute. | Funding note is consumed and the account balance updates after confirmation. Receiving at the Miden account ID alone needs no sender-side Ledger action; consuming requires approval. |
| Session | Load the account: review the grant dialog, then approve `GuardianSession` on the Ledger. Reload and load again. Decline once ("Not now"), then use **Start session** in the signer chip. | One approval starts the session (green dot in the signer chip); the reload resumes it with no prompt; declining leaves Guardian requests on the Ledger until Start session. |
| Sync | Click Sync with the device ready. With no session, repeat and reject a Guardian authentication prompt. | With a session, Sync needs no device approval. Without one, required authentication prompts appear on Ledger; rejection reports a failure; the app does not sign with local/Para/extension keys. Previously displayed state may remain visible. |
| Send | Send a small public note to another test Miden account; repeat with a private note. Sign and Execute each proposal. | Each transaction approval goes to Ledger. The recipient discovers and consumes the note; private sends require working note transport. |
| Add signer | Add a second test signer's **commitment**, retaining threshold 1 initially; Sign and Execute. | Updated account configuration contains the second commitment. |
| Threshold | With the second signer available, change threshold to 2; Sign and Execute under the old threshold. | Account becomes 2-of-2. A subsequent proposal needs both distinct signers before Execute becomes available. Do not raise the threshold without access to both signers. |
| Load | Save the account ID, reload the page, reconnect to the **same** Ledger address, then Load Existing Account. | The stored session resumes (no prompt) and the account/configuration loads; transaction approvals still use Ledger. |
| Logout | With a session active, log out. | The session ends on Guardian; loading again asks for a new grant. |
| Cancellation | Reject address confirmation, reject signing, and unplug during a pending prompt; reconnect and retry. | Rejected address is not selected; invalidated sessions cannot sign. There is no silent software-key fallback. |
| Change address | Choose Change Ledger Address and select a different address. | Previous account session clears. Load an account authorizing the new commitment before signing. |

### Troubleshooting and reporting

- **USB unavailable:** use desktop Chrome/Edge on localhost or HTTPS; check that
  WebHID is allowed by browser/organization policy. Safari/Firefox and mobile
  USB are not supported by this implementation.
- **Device missing/busy:** check the data cable, unlock the device, open Ethereum,
  and close Ledger Live/other device sessions. Close the app dialog and retry.
- **Wrong address:** try the other address layout and check the displayed path.
  Confirm on-device before proceeding; an Ethereum address cannot be converted
  into the signer commitment without the corresponding public key.
- **Authentication waited too long / timestamp error:** check the computer clock,
  keep the device ready, and retry the UI action explicitly. Requests queued more
  than 30 seconds are rejected to avoid signing stale authentication data.
- **No funding / pending transaction:** check Guardian, RPC and note transport
  network alignment. Use Retry funding or manual Sync as appropriate. Hardware
  signing alone does not supply funds or replace those services.

When reporting a failure, include the branch commit (`git rev-parse HEAD`),
Ledger model, firmware and Ethereum app versions, browser/OS, address layout/path,
action, exact app/device error, and whether blind signing was enabled. Include
sanitized console/network errors; do not share a recovery phrase, PIN, private
keys, credentials, or complete signed authentication headers.

### Automated tests and validation status

```bash
npm run test:ledger
npx playwright install chromium
npm run test:ledger:ui
npm run typecheck
npm run build
npm run test:ledger:app
```

The software tests cover real commitment derivation and EIP-712 signatures with
a simulated signing device. Browser tests cover selection and cancellation;
the app smoke test loads the real Ledger SDK without selecting hardware.
These tests do **not** certify physical-device signing. The real Guardian/Miden
execution suite is separate (`npm run test:ledger:services`) and requires funded,
compatible test services. Hardware and live-service acceptance remain unverified.
See [the detailed integration guide](docs/ledger.md) for service-test environment
variables, implementation details and the complete physical-device checklist.

## First run after this RC migration

Existing accounts and proposals from the previous network/serialization version are not migrated. Use a separate browser profile for branch testing so old accounts and local keys remain intact. If you deliberately reset an existing profile, clearing this origin's site data removes its IndexedDB, local storage and cookies, including browser-held keys; preserve any required account/key backups first.

The SDK owns its `MidenClientDB` IndexedDB database. On start-up the app resets it only when it was written by another Miden SDK version, or belongs to another network: it records the node URL and genesis commitment the store was synced against (`midenStoreNetwork` in local storage) and compares them with the configured node's, so a domain that moves from one network to another does not keep sending the old chain's genesis. A store from before this was recorded is reset once. Signer keys remain in the separate `MultisigSignerKeys` database and are never touched.

When a new multisig account is created, the app:

1. registers it with Guardian;
2. registers its note tag locally;
3. calls the node's account-registration endpoint with the invitation code from the create page;
4. on testnet, waits in the background for the initial funding note;
5. exposes that note in **Receive Funds**, where the normal multisig proposal/sign/execute flow deploys and funds the account.

Registration or funding-note discovery can be retried from the dashboard without recreating the account. The app never repeats proposal signing or execution automatically.

## Proposal actions

Proposal rows show `signed/required` directly. Actions are derived from Guardian verification state:

- **Sign** is shown only for an eligible signer who has not already signed.
- **Execute** is shown only when `isProposalActionable()` succeeds.
- transient verification failure receives one automatic sync retry, then exposes **Retry**; with Ledger selected, retries are manual to avoid unsolicited device prompts;
- a non-retryable invalid proposal exposes **Create again** with editable values;
- an **Outdated** proposal (labelled at or below the account's nonce: another transaction took its slot, Guardian 0.18.1) exposes **Create again** instead of collecting signatures;
- completed proposals have no action.

## Key files

- `src/contexts/MultisigContext.tsx` — account, Guardian, proposal, signing, execution, and funding state
- `src/lib/multisigApi.ts` — Guardian/Miden client setup, node registration, and private-note transport
- `src/lib/proposalActions.ts` — centralized proposal action policy
- `src/lib/initClient.ts` — browser Miden client and local signer-key initialization
- `src/hooks/useMidenWallet.ts` — Bread extension adapter
- `src/hooks/useParaSession.ts` — Para signer integration
- `src/config/psm.ts` — runtime endpoint and network configuration

## Troubleshooting

- **Guardian connection fails:** confirm `NEXT_PUBLIC_GUARDIAN_ENDPOINT` points to a Guardian `0.18` on the same network as `NEXT_PUBLIC_MIDEN_RPC_URL`. Restart Next.js after changing `.env.local`.
- **Old account or decoding errors:** the app resets an incompatible local store on start-up; if it persists, clear this origin's site data and reload.
- **Funding note does not arrive (testnet):** registration funds a new account with 1 USDCX, which can take a few minutes; the banner waits up to 10 minutes, then offers **Retry funding**. Accounts that already existed are not funded again; use the testnet faucet (https://faucet.testnet.miden.io) with the account's `mtst1…` address.
- **Node registration fails (devnet, mainnet, custom):** use **Retry registration** in the banner, and confirm the invitation code is accepted by that node. Only testnet funds a new account.
- **Miden Wallet does not connect:** confirm the extension is installed and unlocked, then reconnect using the app's wallet controls.
- **Para does not appear:** set `NEXT_PUBLIC_PARA_API_KEY` and restart the development server.
