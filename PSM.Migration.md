# Migration Plan: Coordinator API to PSM (MultisigClient SDK)

## Context

The MultiSig frontend currently uses a coordinator REST server (`/api/v1/...` endpoints) for all account and transaction operations. We're migrating to use the `@openzeppelin/miden-multisig-client` SDK directly, which talks to a PSM (Private State Manager) endpoint. This eliminates the coordinator server dependency and aligns with the architecture in `private-state-manager/examples/web/`.

**Key changes:**
- Replace coordinator REST API calls with MultisigClient SDK calls
- Switch from `@demox-labs/miden-sdk` v0.12 to `@miden-sdk/miden-sdk` v0.13
- Switch network from testnet to devnet
- Auto-generate local signer keys (Falcon + ECDSA) on app load
- Add Para wallet support alongside existing Miden Wallet adapter
- Replace manual secret key ConnectWalletModal with wallet source selector
- Add PSM endpoint selector/editor (ported from PSM app Header)

---

## Step 1: Update Dependencies

**File:** `bin/coordinator-frontend/package.json`

Remove:
- `@demox-labs/miden-sdk` (v0.12.3)

Add:
- `@miden-sdk/miden-sdk` (^0.13.0)
- `@openzeppelin/miden-multisig-client` (^0.13.0)
- `@openzeppelin/psm-client` (^0.13.0)
- `@miden-sdk/miden-para` (^0.13.0) - Para wallet Miden integration
- `@miden-sdk/use-miden-para-react` (^0.13.0) - Para React hook
- `@getpara/react-sdk-lite` (^2.2.0) - Para modal + provider
- `@tanstack/react-query` (^5.0.0) - required by Para SDK
- `sonner` (for toast notifications)

Keep:
- `@demox-labs/miden-wallet-adapter*` packages (still used for Miden Wallet integration)
- All existing UI dependencies (framer-motion, redux, tailwind, etc.)

> **Note:** If `@openzeppelin/miden-multisig-client` or `@openzeppelin/psm-client` aren't on npm yet, we'll install from the local `private-state-manager` monorepo via `file:` references. We do NOT modify private-state-manager itself.

---

## Step 2: Port Library Functions (from PSM app)

### Create `src/lib/initClient.ts`
Port from `private-state-manager/examples/web/src/lib/initClient.ts`:
- `clearMidenDatabase(dbName)` - deletes IndexedDB for fresh start
- `createWebClient(rpcUrl)` - creates WebClient from `@miden-sdk/miden-sdk`, syncs state
- `initializeSigner()` - generates Falcon + ECDSA key pairs, returns `SignerInfo`

### Create `src/lib/multisigApi.ts`
Port from `private-state-manager/examples/web/src/lib/multisigApi.ts`:
- `createSigner(signerInfo, scheme, external?)` - creates FalconSigner/EcdsaSigner/ParaSigner/MidenWalletSigner
- `initMultisigClient(webClient, psmEndpoint, scheme?)` - initializes MultisigClient
- `createMultisigAccount(client, commitment, otherCommitments, threshold, ...)` - creates account
- `loadMultisigAccount(client, accountId, signer, psmPublicKey?)` - loads existing account

### Create `src/lib/helpers.ts`
Port from `private-state-manager/examples/web/src/lib/helpers.ts`:
- `normalizeCommitment(hex)` - validates and normalizes hex commitment strings
- `truncateHex(hex)` - truncates hex for display
- `copyToClipboard(text)` - clipboard helper

### Create `src/lib/errors.ts`
Port from `private-state-manager/examples/web/src/lib/errors.ts`:
- `formatError(err, prefix?)` - standardized error formatting
- `classifyWalletError(err)` - classifies wallet-specific errors

### Create `src/lib/procedures.ts`
Port from `private-state-manager/examples/web/src/lib/procedures.ts`:
- `USER_PROCEDURES` - procedure info array
- `getProposalProcedure(proposalType)` - maps proposal type to procedure
- `getEffectiveThreshold(proposalType, defaultThreshold, procedureThresholds)` - gets effective threshold

---

## Step 3: Port Wallet Hooks (from PSM app)

### Create `src/hooks/useParaSession.ts`
Port from `private-state-manager/examples/web/src/hooks/useParaSession.ts`:
- Uses `useParaMiden` from `@miden-sdk/use-miden-para-react`
- Derives ECDSA commitment from Para wallet's public key
- Returns `{ session: ExternalWalletState, paraClient, getWalletId }`

### Create `src/hooks/useMidenWallet.ts`
Port from `private-state-manager/examples/web/src/hooks/useMidenWallet.ts`:
- Wraps `MidenWalletAdapter` from `@demox-labs/miden-wallet-adapter-miden`
- Derives commitment from wallet's public key via `PublicKeyFormat.parse()`
- Returns `{ session, connect, disconnect, signBytes, connectError }`

### Create `src/wallets/types.ts`
Port from `private-state-manager/examples/web/src/wallets/types.ts`:
- `WalletSource = 'local' | 'para' | 'miden-wallet'`
- `ExternalWalletState { source, connected, publicKey, commitment, scheme }`

---

## Step 4: Create Configuration

### Create `src/config/psm.ts`
```ts
export const PSM_ENDPOINT = process.env.NEXT_PUBLIC_PSM_ENDPOINT || 'https://psm-stg.openzeppelin.com';
export const MIDEN_RPC_URL = process.env.NEXT_PUBLIC_MIDEN_RPC_URL || 'https://rpc.devnet.miden.io';
export const MIDEN_DB_NAME = 'MidenClientDB';
export const PARA_API_KEY = process.env.NEXT_PUBLIC_PARA_API_KEY || '';
export const PARA_ENVIRONMENT = (process.env.NEXT_PUBLIC_PARA_ENVIRONMENT || 'development') as 'development' | 'production';
```

### Delete `src/config/api.ts` (coordinator API config no longer needed)

---

## Step 5: Create MultisigContext (replaces MidenClientContext)

### Create `src/contexts/MultisigContext.tsx`

Central context modeled after `App.tsx` in the PSM app. Manages all PSM/SDK state and operations.

**State it provides:**
- `webClient: WebClient | null` - Miden blockchain client
- `multisigClient: MultisigClient | null` - PSM multisig client
- `signer: SignerInfo | null` - local signer key pairs (falcon + ecdsa commitments)
- `multisig: Multisig | null` - loaded/created multisig account instance
- `psmStatus: 'connecting' | 'connected' | 'error'`
- `psmUrl: string` - current PSM endpoint URL (editable)
- `psmCommitment: string` - PSM commitment for account creation
- `psmPublicKey: string | undefined` - PSM ECDSA public key
- `proposals: TransactionProposal[]` - synced proposals
- `consumableNotes: array` - available notes
- `detectedConfig: DetectedMultisigConfig | null` - threshold, signerCommitments, vaultBalances
- `psmState: AccountState | null` - PSM account state
- `error: string | null`
- `walletSource: WalletSource` - 'local' | 'para' | 'miden-wallet'
- `activeCommitment: string | null` - commitment from active wallet source
- `activeScheme: SignatureScheme` - current signature scheme
- Loading flags: `creating`, `loadingAccount`, `syncingState`, `signingProposal`, `executingProposal`, `generatingSigner`

**Operations it provides:**
- `handleCreate(otherCommitments, threshold, procedureThresholds?, scheme?)` - create account + register on PSM
- `handleLoad(accountId, scheme?)` - load account + syncAll
- `handleSync()` - sync state with PSM + chain
- `handleSignProposal(proposalId)` - sign a proposal
- `handleExecuteProposal(proposalId)` - execute a proposal
- `handleCreateSendProposal(recipientId, faucetId, amount)` - create send proposal
- `handleCreateConsumeNotesProposal(noteIds)` - create consume notes proposal
- `handleCreateAddSignerProposal(commitment, increaseThreshold)` - add signer proposal
- `handleCreateRemoveSignerProposal(signerToRemove, newThreshold?)` - remove signer proposal
- `handleCreateChangeThresholdProposal(newThreshold)` - change threshold proposal
- `handleCreateSwitchPsmProposal(newEndpoint, newPubkey)` - switch PSM proposal
- `handleDisconnect()` - clear account state
- `setWalletSource(source)` - switch between local/para/miden-wallet
- `connectToPsm(url)` - reconnect to different PSM endpoint
- `setPsmUrl(url)` - update PSM URL

**Initialization (useEffect on mount):**
1. `clearMidenDatabase()`
2. `createWebClient(MIDEN_RPC_URL)` - connect to devnet
3. `connectToPsm(PSM_ENDPOINT, client)` - initialize MultisigClient
4. `initializeSigner()` - generate local Falcon + ECDSA key pairs

**Wallet source management (from PSM App.tsx):**
- Auto-switch to Para when Para modal connects
- Auto-switch to Miden Wallet when it connects
- `activeCommitment` computed from current wallet source
- `activeScheme` computed from current wallet source
- `buildExternalParams()` builds the correct signer params for SDK calls

---

## Step 6: Update Providers

**File:** `src/components/Providers.tsx`

Replace the entire provider tree to match PSM app's setup:
- Outermost: `QueryClientProvider` (for `@tanstack/react-query`, required by Para)
- `ParaProvider` with `paraClientConfig` (API key + environment)
- `Provider` (Redux) - keep for wallet form state only
- `MultisigProvider` (new, replaces MidenClientProvider + MidenSdkProvider)
- Remove: `MidenSdkProvider`, `WalletProvider`, `WalletModalProvider` (replaced by new hooks)

The Miden Wallet adapter is now managed via `useMidenWallet` hook inside MultisigContext, not via a separate WalletProvider.

---

## Step 7: Update Account Creation Flow

**File:** `src/app/login/createNewAccount/page.tsx`

- Step 2 (Add Signers): Keep address + public key fields. The "public key" field value is used as the signer commitment. Address is stored for display/reference.
- Step 4 (Create Account): Replace `createMultiSigWallet(formData)` with:
  ```ts
  const { handleCreate } = useMultisig();
  const commitments = formData.signerPublicKeys; // these are commitments
  await handleCreate(commitments, parseInt(formData.signatureThreshold), undefined, activeScheme);
  ```
- After creation, store `multisig.accountId` via `setWalletId()`
- Remove import of `createMultiSigWallet` from `services/walletApi`

---

## Step 8: Update Account Loading Flow

**File:** `src/app/login/loadExistingAccount/page.tsx`

- Replace `Address.fromBech32()` + address conversion logic with:
  ```ts
  const { handleLoad } = useMultisig();
  await handleLoad(accountId, activeScheme);
  ```
- Input field changes from "Account Address" (bech32) to "Account ID" (hex, 0x prefix optional)
- Remove import of `Address`, `NetworkId` from old SDK

---

## Step 9: Update Dashboard - Home Page

**File:** `src/app/dashboard/home/page.tsx`

Replace coordinator API thunks with MultisigContext:
- Replace `useWalletData()` hook with `useMultisig()` context
- `detectedConfig.signerCommitments` -> approvers/signers list
- `detectedConfig.threshold` -> signature threshold
- `detectedConfig.vaultBalances` -> asset balances
- `proposals` filtered by status -> pending/confirmed transactions
- Derive stats from proposals array instead of `fetchTransactionStatsThunk`

---

## Step 10: Update Dashboard - Assets, Transactions, Settings Pages

**File:** `src/app/dashboard/assets/page.tsx`
- Use `detectedConfig.vaultBalances` from MultisigContext

**File:** `src/app/dashboard/transactions/page.tsx`
- Use `proposals` from MultisigContext

**File:** `src/app/dashboard/settings/page.tsx` and sub-components:
- `Signers.tsx` - use `detectedConfig.signerCommitments` (displayed as hex)
- `Security.tsx` - replace `WalletInfo` / `useWallet()` with MultisigContext wallet state
- `General.tsx` - use MultisigContext data

---

## Step 11: Update Dashboard Components

**File:** `src/app/dashboard/components/PendingActions.tsx`
- Replace `useWallet()` from `@demox-labs/miden-wallet-adapter` with MultisigContext
- Use `proposals` from context, `handleSignProposal`, `handleExecuteProposal`

**File:** `src/app/dashboard/components/RecentTransactions.tsx`
- Use `proposals` from MultisigContext (filter executed/recent)

**File:** `src/app/dashboard/components/Taskbar.tsx`
- Replace `ConnectWalletModal` (secret key input) with wallet source indicator
- Show local commitment (copyable), wallet source selector, Para/Miden Wallet connect buttons
- Add PSM endpoint selector/editor (from PSM Header.tsx) with status badge
- Use `handleSync` from MultisigContext for refresh
- Replace `useWalletData()` with `useMultisig()` context

---

## Step 12: Update Transaction Interactions

**File:** `src/interactions/InitiateFundTransfer.tsx`
- Replace `proposeTransactionWithTxBzThunk` with `handleCreateSendProposal(recipientId, faucetId, amount)`

**File:** `src/interactions/ApproveFundTransfer.tsx`
- Replace signature API with `handleSignProposal(proposalId)`

**File:** `src/interactions/signTransaction.tsx`
- Replace signature/execution logic with `handleSignProposal` and `handleExecuteProposal`

---

## Step 13: Update Types

**File:** `src/types/` directory

Add new types (ported from PSM app):
- `SignerKeyInfo { commitment: string; secretKey: AuthSecretKey }`
- `SignerInfo { falcon: SignerKeyInfo; ecdsa: SignerKeyInfo; activeScheme: SignatureScheme }`
- `WalletSource = 'local' | 'para' | 'miden-wallet'`
- `ExternalWalletState { source, connected, publicKey, commitment, scheme }`
- Re-export `TransactionProposal`, `DetectedMultisigConfig`, `AccountState`, `SignatureScheme` from `@openzeppelin/miden-multisig-client`

Update existing type files to accommodate proposals (instead of coordinator transactions).

---

## Step 14: Clean Up - Remove Coordinator API Layer

### Delete files:
- `src/services/walletApi.ts` - coordinator wallet API
- `src/services/transactionApi.ts` - coordinator transaction API
- `src/services/signatureApi.ts` - coordinator signature API
- `src/config/api.ts` - coordinator URL config
- `src/contexts/MidenClientContext.tsx` - replaced by MultisigContext
- `src/hooks/useMidenSdk.tsx` - replaced by MultisigContext
- `lib/miden-client.ts` - replaced by src/lib/initClient.ts
- `src/components/ConnectWalletModal.tsx` - replaced by wallet source in Taskbar
- `src/hooks/useWalletData.ts` - replaced by MultisigContext

### Simplify Redux:
- `src/store/slices/walletSlice.ts` - keep form data for wizard only; remove approver/walletData state and API thunks
- `src/store/slices/transactionSlice.ts` - delete (replaced by context proposals)
- `src/store/slices/signatureSlice.ts` - delete (replaced by context)
- `src/store/slices/walletStatsSlice.ts` - delete (stats derived from context)
- `src/store/index.ts` - update to only include walletSlice

---

## Step 15: Update WASM & Next.js Config

**File:** `next.config.mjs`
- Update WASM copy paths for `@miden-sdk/miden-sdk` v0.13 (may use different WASM file)
- Keep `asyncWebAssembly` experiment and CORS headers
- Add webpack resolve alias for `@miden-sdk/miden-sdk` if needed (similar to PSM's vite config)
- Stub Para optional modules (`@getpara/evm-wallet-connectors`, etc.) via webpack plugin

**File:** `public/miden_client_web.wasm`
- Replace/update from the new SDK's distribution

---

## Step 16: Update Middleware & Auth

**File:** `src/middleware.ts`
- Keep same cookie-based auth pattern
- Wallet ID is now a hex account ID instead of bech32 address

**File:** `src/hooks/useAuth.ts`
- No structural changes; stores/retrieves `currentWalletId`
- Value format changes from bech32 to hex account ID

---

## Files Summary

### New files (12):
- `src/lib/initClient.ts`
- `src/lib/multisigApi.ts`
- `src/lib/helpers.ts`
- `src/lib/errors.ts`
- `src/lib/procedures.ts`
- `src/config/psm.ts`
- `src/contexts/MultisigContext.tsx`
- `src/hooks/useParaSession.ts`
- `src/hooks/useMidenWallet.ts` (new version, replaces old wallet adapter wrapper)
- `src/wallets/types.ts`
- `src/wallets/index.ts`

### Modified files (~17):
- `package.json`
- `next.config.mjs`
- `src/components/Providers.tsx`
- `src/app/login/createNewAccount/page.tsx`
- `src/app/login/loadExistingAccount/page.tsx`
- `src/app/dashboard/home/page.tsx`
- `src/app/dashboard/assets/page.tsx`
- `src/app/dashboard/transactions/page.tsx`
- `src/app/dashboard/settings/page.tsx`
- `src/app/dashboard/settings/components/Signers.tsx`
- `src/app/dashboard/settings/components/Security.tsx`
- `src/app/dashboard/settings/components/General.tsx`
- `src/app/dashboard/components/PendingActions.tsx`
- `src/app/dashboard/components/RecentTransactions.tsx`
- `src/app/dashboard/components/Taskbar.tsx`
- `src/interactions/InitiateFundTransfer.tsx`
- `src/interactions/ApproveFundTransfer.tsx`
- `src/interactions/signTransaction.tsx`
- `src/store/index.ts`
- `src/store/slices/walletSlice.ts`
- `src/types/` files

### Deleted files (9):
- `src/services/walletApi.ts`
- `src/services/transactionApi.ts`
- `src/services/signatureApi.ts`
- `src/config/api.ts`
- `src/contexts/MidenClientContext.tsx`
- `src/hooks/useMidenSdk.tsx`
- `src/hooks/useWalletData.ts`
- `src/components/ConnectWalletModal.tsx`
- `lib/miden-client.ts`

---

## Verification

1. **Install & build:** `npm install && npm run build` completes without errors
2. **Dev server:** `npm run dev` starts at localhost:3000
3. **Login page:** Shows create/load options, console shows PSM connected + local keys generated
4. **Create flow:** Enter account name, threshold, signer commitments, create calls PSM SDK
5. **Load flow:** Enter hex account ID, loads from PSM, syncs proposals/state
6. **Dashboard:** Shows vault balances, proposals, signer commitments from `detectedConfig`
7. **Wallet sources:** Can switch between local/Para/Miden Wallet; commitment updates accordingly
8. **Para wallet:** Para modal opens, connects, derives ECDSA commitment, can sign proposals
9. **Miden Wallet:** Browser extension connects, derives commitment, can sign proposals
10. **Transactions:** Can create send proposals, sign with any wallet source, execute proposals
11. **No coordinator dependency:** App functions without the coordinator server running
12. **PSM selector:** Can view/edit PSM endpoint URL and reconnect from the Taskbar
