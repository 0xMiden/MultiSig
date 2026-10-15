"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { toast } from "sonner";

import {
  type Multisig,
  type MultisigClient,
  type AccountState,
  type SyncStateResult,
  type DetectedMultisigConfig,
  type Proposal,
  type SignatureScheme,
  type ProcedureThreshold,
  type ProcedureName,
  type ParaSigningContext,
  AccountInspector,
  isProposalActionable,
} from "@openzeppelin/miden-multisig-client";
import { GuardianHttpError, type GuardianHttpClient, type SessionGrantFields, type Signer } from "@openzeppelin/guardian-client";
import { Note, NoteType, type MidenClient } from "@miden-sdk/miden-sdk";

import { normalizeCommitment } from "@/lib/helpers";
import { buildAdminTransactionRequest, createAdminProposalWith } from "@/lib/admin/adminRequest";
import { executeCustomProposal } from "@/lib/admin/adminExecute";
import { buildDirectAdminTransactionRequest, submitDirectAdminAction } from "@/lib/admin/directAction";
import { useOnChainHistory, type OnChainHistory } from "@/hooks/useOnChainHistory";
import { buildAdminNoteBytes } from "@/lib/admin/noteBuilders";
import { recipeTarget, type AdminRecipe } from "@/lib/admin/recipe";
import { profileOf } from "@/lib/admin/target";
import {
  recordObserved,
  recordExecuted,
  recordDiscarded,
  historyEntries,
  statsFromEntries,
  type ProposalHistoryEntry,
  type HistoryStats,
} from "@/lib/proposalHistory";
import { formatError, classifyWalletError, describeExecutionError, UserFacingError } from "@/lib/errors";
import {
  createMidenClient,
  initializeSigner as initSigner,
  loadSignerKeys,
  saveSignerKeys,
} from "@/lib/initClient";
import {
  initMultisigClient,
  createMultisigAccount,
  loadMultisigAccount,
  loadPendingMultisigAccount,
  createSigner,
  registerAccountNoteTag,
  getOutputNotesFromTxSummary,
  registerAccountOnNode,
  latestCanonicalPrivateNotes,
  noteChainChecks,
  multisigGuardian,
  nodeRegistrationMissing,
  type NoteChainChecks,
  type LatestPrivateNote,
} from "@/lib/multisigApi";
import type { ExternalSignerParams } from "@/lib/multisigApi";
import { CONFIG_ERRORS, GUARDIAN_ENDPOINT, LOCAL_KEYS_ENABLED, MIDEN_DB_NAME, MIDEN_NETWORK, MIDEN_RPC_URL, MIDEN_SDK_VERSION } from "@/config/psm";
import { assertInvitationCodeValid, fundsOnRegistration, invitationCodeRequired } from "@/lib/midenNetwork";
import {
  assertConfigured,
  deriveStartupState,
  resetStoreExclusively,
  startHoldingStoreLock,
  waitForClientParts,
  type StartupState,
} from "@/lib/clientStartup";
import { readNodeIdentity } from "@/lib/nodeRegistration";
import type { SignerInfo } from "@/types/psm";
import type { WalletSource } from "@/wallets/types";
import { getProposalActionState } from "@/lib/proposalActions";
import { useParaSession } from "@/hooks/useParaSession";
import { useLedgerSession, type LedgerSession } from "@/hooks/useLedgerSession";
import { deployedGuardianUrlProblem, normalizeGuardianUrl, switchGuardianProblem } from "@/lib/guardianUrl";
import {
  GuardianSessionManager,
  forgetAllSessionKeys,
  guardianEndpoint,
  retryIfSessionDied,
  sessionGrantRows,
  walletUsesSessions,
  type GuardianSessionState,
} from "@/lib/guardianSession";
import { runRegistrationRetry } from "@/lib/registrationRetry";
import {
  decodeNote,
  deliverCommittedNotes,
  NoteNotOnChainError,
  encodeNote,
  pendingDeliveries,
  recordPendingDelivery,
  removePendingDelivery,
} from "@/lib/privateDelivery";
import { setWalletCookie } from "@/lib/walletCookie";
import { waitForFundingNote } from "@/lib/fundingWait";
import {
  ensureLatestPrivateNotesDelivered,
  isPrivateNoteBlockedMessage,
  PrivateNoteBlockedError,
  UndeliveredPrivateNoteError,
} from "@/lib/privateNoteGuard";
import { useMidenWallet } from "@/hooks/useMidenWallet";
import { MidenWalletAdapter } from "@miden-sdk/miden-wallet-adapter-miden";
import { diagnosticError, diagnosticLog, logReceiveFunding } from '@/lib/midenDiagnostics';
import {
  clearExecutionPushed,
  executionWasPushed,
  findLockedCandidate,
  isPendingCandidateError,
  msUntilUnlockable,
  releasePendingCandidate,
  type LockedCandidate,
} from "@/lib/pendingCandidate";

export type AccountLock = LockedCandidate & { accountId: string };

export type PrivateSendStep =
  | "idle"
  | "creating-proposal"
  | "done"
  | "error";

export interface PrivateSendProgress {
  step: PrivateSendStep;
  totalNotes: number;
  relayedNotes: number;
  error?: string;
}

export type AccountFundingPhase =
  | "idle"
  | "registering"
  | "waiting-for-note"
  | "funding-available"
  | "error";

export interface SessionGrantPrompt {
  id: number;
  rows: Array<{ label: string; value: string }>;
}

export interface AccountFundingState {
  phase: AccountFundingPhase;
  message?: string;
  /**
   * The account is not registered on the node and the code to register it is
   * not known here: the creator's code lives only in the creating tab's memory,
   * so after a reload or on another device it must be entered again (mainnet).
   */
  needsInvitationCode?: boolean;
}

/**
 * Track the account's note tag. Re-adding a tracked tag succeeds, so a failure
 * is real and incoming notes can go unseen: warn instead of hiding it.
 */
async function watchAccountNotes(midenClient: MidenClient, accountId: string): Promise<void> {
  try {
    await registerAccountNoteTag(midenClient, accountId);
  } catch (err) {
    toast.warning(`Could not watch this account's note tag: ${formatError(err)}. Incoming notes may not appear.`, { id: "note-tag" });
  }
}

/** Fetch private notes; having none is not an error, failing to reach the transport is. */
async function fetchPrivateNotes(midenClient: MidenClient): Promise<void> {
  try {
    await midenClient.notes.fetchPrivate();
  } catch (err) {
    toast.warning(`Could not fetch private notes: ${formatError(err)}. Private deposits may be missing until the next sync.`, { id: "private-fetch" });
  }
}

export interface UndeliveredNote { proposalId: string; recipientId: string; error: string }

/**
 * Whether the account may be used: no operation runs while a private note of
 * its latest transaction is neither delivered nor consumed (privateNoteGuard.ts).
 */
export type PrivateNoteGuardState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "clear" }
  /** A private note exists and could not be delivered. */
  | { phase: "blocked"; error: string }
  /** The check could not run (Guardian or node unreachable); the account waits for it. */
  | { phase: "unverified"; error: string };

/** The message to show for an operation's error: a user-facing one as it is, anything else via `describe`. */
const NOT_REGISTERED = "This account is not registered on the network yet, so its first transaction would be refused.";
const CODE_NEEDED = "This account is not registered on the network yet. Enter its invitation code to register it.";

function operationErrorMessage(err: unknown, describe: (err: unknown) => string): string {
  return err instanceof UserFacingError ? err.message : describe(err);
}

export type GuardianConnectResult = { ok: true } | { ok: false; error: string };

export interface MultisigContextValue {
  // Core state
  midenClient: MidenClient | null;
  multisigClient: MultisigClient | null;
  signer: SignerInfo | null;
  multisig: Multisig | null;
  error: string | null;
  pendingCandidateWarning: string | null;
  /** Set when Execute was refused because an earlier candidate is still pending on Guardian. */
  /** The execution holding this account's Guardian lock, when one was found. */
  lockedCandidate: AccountLock | null;
  releasingCandidate: boolean;
  accountFunding: AccountFundingState;

  // Guardian state
  guardianUrl: string;
  guardianStatus: "connected" | "connecting" | "error";
  guardianCommitment: string;
  guardianPublicKey: string | undefined;
  guardianState: AccountState | null;

  // Multisig data
  detectedConfig: DetectedMultisigConfig | null;
  proposals: Proposal[];
  consumableNotes: Array<{
    id: string;
    assets: Array<{ faucetId: string; amount: bigint }>;
  }>;

  // Wallet state
  ledger: LedgerSession;
  walletSource: WalletSource;
  activeCommitment: string | null;
  activeScheme: SignatureScheme;
  paraSession: {
    connected: boolean;
    commitment: string | null;
    publicKey: string | null;
  };
  midenWalletSession: { connected: boolean; commitment: string | null; address?: string | null };

  // Loading flags
  creating: boolean;
  registeringOnGuardian: boolean;
  guardianRegistrationRequired: boolean;
  loadingAccount: boolean;
  syncingState: boolean;
  creatingProposal: boolean;
  signingProposal: string | null;
  executingProposal: string | null;
  generatingSigner: boolean;

  // Operations
  handleCreate: (
    otherSignerCommitments: string[],
    threshold: number,
    procedureThresholds?: ProcedureThreshold[],
    signatureScheme?: SignatureScheme,
    /** Node-registration invitation code from the create page (pre-filled per network, required on mainnet); sent on every network. */
    options?: { invitationCode?: string },
  ) => Promise<void>;
  handleLoad: (
    accountId: string,
    signatureScheme?: SignatureScheme,
  ) => Promise<void>;
  handleSync: () => Promise<void>;
  retryGuardianRegistration: () => Promise<void>;
  retryAccountFunding: () => Promise<void>;
  /** The loaded account's nonce, when known (outdated proposals). */
  accountNonce: bigint | null;
  /** The wallet's Guardian session (see guardianSession.ts). */
  guardianSession: GuardianSessionState;
  /** Starts it again after it failed, was declined or ended. */
  startGuardianSession: () => Promise<void>;
  /** Ends it on Guardian (logout). */
  endGuardianSession: () => Promise<void>;
  /** A session grant waiting for the user's confirmation, shown before the wallet signs it. */
  sessionGrantPrompt: SessionGrantPrompt | null;
  answerSessionGrant: (id: number, approved: boolean) => void;
  /** Registers the loaded account on the node with an invitation code typed in the banner. */
  registerWithInvitationCode: (code: string) => Promise<void>;
  retryProposalVerification: (proposalId: string) => Promise<void>;
  handleSignProposal: (proposalId: string) => Promise<void>;
  handleExecuteProposal: (proposalId: string) => Promise<void>;
  handleCancelProposal: (proposalId: string) => Promise<void>;
  cancelingProposal: string | null;
  dismissedProposalIds: ReadonlySet<string>;
  /**
   * Durable, per-account proposal history (newest-first). Unlike `proposals`
   * (Guardian's pending-only, pruned-on-execute list), this records every
   * proposal this browser has seen with its decoded action and terminal status,
   * so executed/discarded proposals and accurate totals survive the prune.
   */
  proposalHistory: ProposalHistoryEntry[];
  /** Totals derived from `proposalHistory` for the Transaction-tab summary cards. */
  proposalStats: HistoryStats;
  unlockAccount: () => Promise<void>;
  handleCreateP2idProposal: (
    recipientId: string,
    faucetId: string,
    amount: bigint,
  ) => Promise<void>;
  handleCreateAdminProposal: (
    recipe: Omit<AdminRecipe, "saltHex" | "boundBlockNum" | "noteIdHex"> &
      Partial<Pick<AdminRecipe, "saltHex" | "boundBlockNum">>,
  ) => Promise<void>;
  /**
   * Runs an admin action directly from the account connected through Bread (which must itself
   * hold the action's role): no proposal, Bread signs and submits. Resolves to the transaction id.
   */
  handleDirectAdminAction: (
    recipe: Omit<AdminRecipe, "saltHex" | "boundBlockNum" | "noteIdHex">,
  ) => Promise<string>;
  /** The loaded account's on-chain transaction history, read from the node (History page). */
  onChainHistory: OnChainHistory;
  handleSendPrivateNote: (
    recipientId: string,
    faucetId: string,
    amount: bigint,
  ) => Promise<void>;
  privateSendProgress: PrivateSendProgress;
  resetPrivateSendProgress: () => void;
  handleCreateConsumeNotesProposal: (noteIds: string[]) => Promise<void>;
  handleCreateAddSignerProposal: (
    commitment: string,
    increaseThreshold: boolean,
  ) => Promise<void>;
  handleCreateRemoveSignerProposal: (
    signerToRemove: string,
    newThreshold?: number,
  ) => Promise<void>;
  handleCreateChangeThresholdProposal: (newThreshold: number) => Promise<void>;
  /** Proposes a per-procedure signature threshold that overrides the account's default. */
  handleCreateProcedureThresholdProposal: (procedure: ProcedureName, threshold: number) => Promise<void>;
  handleCreateSwitchGuardianProposal: (
    newEndpoint: string,
    newPubkey: string,
  ) => Promise<void>;
  handleExportProposal: (proposalId: string) => void;
  handleSignProposalOffline: (proposalId: string) => Promise<void>;
  handleImportProposal: (json: string) => Promise<void>;
  handleDisconnect: () => void;
  setWalletSource: (source: WalletSource) => void;
  /** Private notes of executed sends not yet delivered to their recipient. */
  undeliveredNotes: UndeliveredNote[];
  /** Try again to deliver this account's undelivered private notes. */
  retryPrivateDeliveries: () => Promise<void>;
  /** Whether earlier private notes have reached their recipients; operations wait for "clear". */
  privateNoteGuard: PrivateNoteGuardState;
  /** Start-up of the in-browser Miden client (downloads and compiles the SDK). */
  clientStartup: StartupState;
  /** Start the Miden client again after a failed start-up. */
  retryClientStartup: () => Promise<void>;
  /** True while any account operation runs; wallet and Guardian changes wait for it. */
  accountOperationBusy: boolean;
  setGuardianUrl: (url: string) => void;
  /** Resolves (never rejects) with whether the app is now using this Guardian. */
  connectToGuardian: (url: string) => Promise<GuardianConnectResult>;
  dismissWarning: () => void;
  setError: (error: string | null) => void;

  // Wallet actions
  connectMidenWallet: () => Promise<void>;
  disconnectMidenWallet: () => Promise<void>;
  openParaModal: () => void;
  paraModalOpen: boolean;
  closeParaModal: () => void;

}

const MultisigContext = createContext<MultisigContextValue | null>(null);

export function useMultisig(): MultisigContextValue {
  const ctx = useContext(MultisigContext);
  if (!ctx) throw new Error("useMultisig must be used within MultisigProvider");
  return ctx;
}

export function MultisigProvider({ children }: { children: React.ReactNode }) {
  const [midenClient, setMidenClient] = useState<MidenClient | null>(null);
  const [multisigClient, setMultisigClient] = useState<MultisigClient | null>(
    null,
  );
  const [signer, setSigner] = useState<SignerInfo | null>(null);
  const [generatingSigner, setGeneratingSigner] = useState(false);
  const [multisig, setMultisig] = useState<Multisig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCandidateWarning, setPendingCandidateWarning] = useState<
    string | null
  >(null);
  const [lockedCandidate, setLockedCandidate] = useState<AccountLock | null>(null);
  const [releasingCandidate, setReleasingCandidate] = useState(false);
  // Execute and unlock both drive the account's single Guardian lock; never let
  // them overlap (double clicks, or Execute pressed mid-unlock). Holds the id of
  // the account the operation belongs to, so a switch never blocks the next one.
  const accountOpInFlight = useRef<string | null>(null);
  // Long-running work checks this after every await and stops touching state
  // once the user has moved to another account.
  const multisigRef = useRef<Multisig | null>(null);
  // Invitation codes entered at creation, per account, so Retry funding reuses them.
  const invitationCodes = useRef(new Map<string, string>());
  multisigRef.current = multisig;
  const fundingAccountId = useRef<string | null>(null);
  // Each funding attempt's number: a newer attempt stops an older one's wait.
  const fundingRun = useRef(0);
  // Background registration or funding failures, per account (lowercase ID),
  // so Retry funding is offered again when that account is loaded.
  const fundingFailures = useRef(new Map<string, string>());
  const [accountFunding, setAccountFunding] = useState<AccountFundingState>({
    phase: "idle",
  });

  const [guardianUrl, setGuardianUrl] = useState(GUARDIAN_ENDPOINT);
  const [guardianStatus, setGuardianStatus] = useState<
    "connected" | "connecting" | "error"
  >("connecting");
  const [guardianCommitment, setGuardianCommitment] = useState("");
  // Start-up: only whether a build is running and why the last one failed are
  // tracked; the phase is derived from the client parts (see deriveStartupState).
  const [startupBuilding, setStartupBuilding] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [undeliveredNotes, setUndeliveredNotes] = useState<UndeliveredNote[]>([]);
  const [privateNoteGuard, setPrivateNoteGuard] = useState<PrivateNoteGuardState>({ phase: "idle" });
  // The loaded account's nonce: proposals labelled at or below it are outdated.
  const [accountNonce, setAccountNonce] = useState<bigint | null>(null);
  const privateNoteGuardRef = useRef(privateNoteGuard);
  privateNoteGuardRef.current = privateNoteGuard;
  // Action handlers are defined before the delivery code; they reach the guard
  // through this ref (assigned below, next to checkPrivateNotes).
  const ensurePrivateNotesClearRef = useRef<(ms: Multisig) => Promise<void>>(async () => {});
  const [guardianPublicKey, setGuardianPublicKey] = useState<
    string | undefined
  >(undefined);
  const [guardianState, setGuardianState] = useState<AccountState | null>(null);

  const [creating, setCreating] = useState(false);
  const [registeringOnGuardian, setRegisteringOnGuardian] = useState(false);
  const [guardianRegistrationRequired, setGuardianRegistrationRequired] = useState(false);
  const registrationRetryInProgress = useRef(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [detectedConfig, setDetectedConfig] =
    useState<DetectedMultisigConfig | null>(null);
  const [syncingState, setSyncingState] = useState(false);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalHistory, setProposalHistory] = useState<ProposalHistoryEntry[]>([]);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [signingProposal, setSigningProposal] = useState<string | null>(null);
  const [cancelingProposal, setCancelingProposal] = useState<string | null>(null);
  const [dismissedProposalIds, setDismissedProposalIds] = useState<ReadonlySet<string>>(new Set());
  const [executingProposal, setExecutingProposal] = useState<string | null>(
    null,
  );
  const [privateSendProgress, setPrivateSendProgress] =
    useState<PrivateSendProgress>({
      step: "idle",
      totalNotes: 0,
      relayedNotes: 0,
    });

  const [consumableNotes, setConsumableNotes] = useState<
    Array<{ id: string; assets: Array<{ faucetId: string; amount: bigint }> }>
  >([]);

  const [walletSource, setWalletSourceState] = useState<WalletSource>(() => {
    if (typeof window === "undefined") return "miden-wallet";
    const saved = localStorage.getItem("currentWalletSource") as WalletSource | null;
    if (saved === "local" && !LOCAL_KEYS_ENABLED) return "miden-wallet";
    return saved ?? "miden-wallet";
  });
  const [paraModalOpen, setParaModalOpen] = useState(false);
  const ledger = useLedgerSession();
  const disconnectLedger = ledger.disconnect;
  const latestLedgerSigner = useRef(ledger.signer);
  latestLedgerSigner.current = ledger.signer;
  // Latest client parts and start-up state, for handlers that wait for start-up:
  // a click during start-up must use the clients that exist once it finishes,
  // not the empty values captured when it was clicked.
  const clientPartsRef = useRef<{ midenClient: MidenClient; multisigClient: MultisigClient; guardianCommitment: string } | null>(null);
  clientPartsRef.current = midenClient && multisigClient && guardianCommitment
    ? { midenClient, multisigClient, guardianCommitment }
    : null;
  const clientStartup = useMemo(
    () => deriveStartupState({
      ready: Boolean(midenClient && multisigClient && guardianCommitment),
      building: startupBuilding,
      error: startupError,
      guardianFailed: guardianStatus === "error",
    }),
    [midenClient, multisigClient, guardianCommitment, startupBuilding, startupError, guardianStatus],
  );
  const clientStartupRef = useRef<StartupState>(clientStartup);
  clientStartupRef.current = clientStartup;
  const midenClientRef = useRef(midenClient);
  midenClientRef.current = midenClient;
  const signerRef = useRef(signer);
  signerRef.current = signer;
  const guardianStateRef = useRef(guardianState);
  guardianStateRef.current = guardianState;
  const waitForClient = useCallback(
    () => waitForClientParts(
      () => (clientStartupRef.current.phase === "ready" ? clientPartsRef.current : null),
      () => clientStartupRef.current,
    ),
    [],
  );

  // Pull Guardian state (unless the caller already has it), proposals and notes
  // for a multisig, and publish them with the account's config.
  const refreshAccount = useCallback(async (ms: Multisig, knownSync?: SyncStateResult) => {
    const sync = knownSync ?? await ms.syncState();
    const [synced, notes] = await Promise.all([ms.syncProposals(), ms.getConsumableNotes()]);
    // syncState skips the download when Guardian has nothing newer than the
    // local account (source 'local'); keep the state already known then, and
    // fetch it once if there is none yet.
    if (sync.source === "guardian") setGuardianState(sync.state);
    else if (!guardianStateRef.current) setGuardianState(await ms.fetchState());
    setDetectedConfig(AccountInspector.fromAccount(ms.account));
    if (multisigRef.current === ms) setAccountNonce(ms.account.nonce().asInt());
    setProposals(synced);
    setConsumableNotes(notes);
  }, []);

  // Any account operation in flight: wallets and Guardian must not change under it.
  const accountOperationBusy = creating || loadingAccount || creatingProposal || Boolean(signingProposal)
    || Boolean(executingProposal) || releasingCandidate || syncingState || registeringOnGuardian
    || privateSendProgress.step === "creating-proposal";

  // A sync that fails on the nonce right after execute usually means Guardian
  // has not caught up. If the chain confirms the local state, show its config;
  // returns true when the failure is that benign "local is ahead" case.
  const handleLocalStateAhead = useCallback(async (ms: Multisig, message: string): Promise<boolean> => {
    if (message.includes("nonce")) {
      try {
        await ms.verifyStateCommitment();
        setDetectedConfig(AccountInspector.fromAccount(ms.account));
      } catch {
        /* the chain has not confirmed the local state yet */
      }
    }
    if (!message.includes("account nonce is too low to import")) return false;
    setPendingCandidateWarning(
      "Sync warning: local state is ahead of the on-chain state. " +
        "This can happen right after executing a transaction. Please wait a moment and sync again.",
    );
    return true;
  }, []);

  const setWalletSource = useCallback((source: WalletSource) => {
    if (source === walletSource) return;
    if (source === "local" && !LOCAL_KEYS_ENABLED) return;
    if (accountOperationBusy) {
      toast.error("Finish or cancel the current account operation before switching wallets.");
      return;
    }
    if (walletSource === "ledger") disconnectLedger();
    // Multisig instances bind their signer at construction; require an explicit reload.
    setMultisig(null); setGuardianState(null); setDetectedConfig(null);
    setGuardianRegistrationRequired(false);
    setProposals([]); setConsumableNotes([]);
    localStorage.setItem("currentWalletSource", source);
    setWalletSourceState(source);
  }, [walletSource, disconnectLedger, accountOperationBusy]);

  useEffect(() => {
    if (ledger.signer) setWalletSource("ledger");
  }, [ledger.signer, setWalletSource]);

  // A loaded account is bound to the Ledger signer it was loaded with. Unload
  // it when that signer goes away or is swapped for another address.
  const boundLedgerSigner = useRef(ledger.signer);
  useEffect(() => {
    const previous = boundLedgerSigner.current;
    boundLedgerSigner.current = ledger.signer;
    const swapped = previous !== null && ledger.signer !== null && previous !== ledger.signer;
    if (walletSource === "ledger" && (!ledger.signer || swapped)) {
      setMultisig(null); setGuardianState(null); setDetectedConfig(null);
      setGuardianRegistrationRequired(false);
      setProposals([]); setConsumableNotes([]);
    }
  }, [walletSource, ledger.signer, multisig]);


  const { session: paraSession, paraClient, getWalletId, error: paraError } = useParaSession();
  const [midenWalletAdapter, setMidenWalletAdapter] = useState(
    () => new MidenWalletAdapter({ appName: "Miden Multisig" }),
  );
  const {
    session: midenWalletSession,
    connect: connectMidenWalletRaw,
    disconnect: disconnectMidenWalletRaw,
    signBytes,
    connectError: midenWalletConnectError,
  } = useMidenWallet(midenWalletAdapter);

  useEffect(() => {
    if (midenWalletConnectError) {
      toast.error(midenWalletConnectError);
    }
  }, [midenWalletConnectError]);

  useEffect(() => {
    if (paraError) toast.error(`Para connection failed: ${paraError}`);
  }, [paraError]);

  const wasParaConnected = useRef(false);
  useEffect(() => {
    if (paraSession.connected && !wasParaConnected.current) {
      setWalletSource("para");
      if (paraModalOpen) setParaModalOpen(false);
    }
    wasParaConnected.current = paraSession.connected;
  }, [paraSession.connected, paraModalOpen, setWalletSource]);

  const wasMidenConnected = useRef(false);
  useEffect(() => {
    if (midenWalletSession.connected && !wasMidenConnected.current) {
      setWalletSource("miden-wallet");
    }
    wasMidenConnected.current = midenWalletSession.connected;
  }, [midenWalletSession.connected, setWalletSource]);

  // Attempt to auto-connect external wallets once the Miden client exists. The
  // wallet's connect handler derives the key commitment with the SDK's WASM,
  // which is loaded while the client is created; connecting any earlier (on
  // mount) fails in that handler and leaves the wallet "not connected".
  const autoConnectAttempted = useRef(false);
  useEffect(() => {
    if (!midenClient || autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    const savedSource = localStorage.getItem("currentWalletSource");
    if (savedSource === "miden-wallet") {
      connectMidenWalletRaw().catch(() => {
        // Silently ignore auto-connect failures
      });
    }
  }, [connectMidenWalletRaw, midenClient]);

  // Null means "not connected": an external wallet source never borrows the
  // browser's local key.
  const activeCommitment = useMemo(() => {
    if (walletSource === "ledger") return ledger.signer?.commitment ?? null;
    if (walletSource === "para")
      return paraSession.connected ? paraSession.commitment : null;
    if (walletSource === "miden-wallet")
      return midenWalletSession.connected ? midenWalletSession.commitment : null;
    if (!LOCAL_KEYS_ENABLED || !signer) return null;
    return signer.activeScheme === "ecdsa"
      ? signer.ecdsa.commitment
      : signer.falcon.commitment;
  }, [walletSource, paraSession, midenWalletSession, signer, ledger.signer]);

  const activeScheme = useMemo((): SignatureScheme => {
    if (walletSource === "para" || walletSource === "ledger") return "ecdsa";
    if (walletSource === "miden-wallet" && midenWalletSession.scheme)
      return midenWalletSession.scheme;
    return signer?.activeScheme ?? "falcon";
  }, [walletSource, midenWalletSession, signer]);

  const buildExternalParams = useCallback(():
    | ExternalSignerParams
    | undefined => {
    if (walletSource === "ledger") {
      if (!ledger.signer) throw new Error("Connect and select a Ledger account first");
      return { walletSource: "ledger", ledgerSigner: ledger.signer };
    }
    // Every external source fails closed: a disconnected wallet must never fall
    // through to a key the user did not choose.
    if (walletSource === "para") {
      if (!paraSession.connected || !paraClient) throw new Error("Connect your Para wallet first");
      const walletId = getWalletId();
      if (!walletId || !paraSession.commitment || !paraSession.publicKey)
        throw new Error("Your Para session is incomplete. Reconnect Para and try again");
      return {
        walletSource: "para",
        paraContext: {
          para: paraClient as ParaSigningContext,
          walletId,
          commitment: paraSession.commitment,
          publicKey: paraSession.publicKey,
        },
      };
    }
    if (walletSource === "miden-wallet") {
      if (!midenWalletSession.connected) throw new Error("Connect Bread first");
      if (!midenWalletSession.commitment || !midenWalletSession.scheme) {
        throw new Error("Bread did not share its signing key. Reconnect it and try again");
      }
      return {
        walletSource: "miden-wallet",
        midenWalletContext: {
          wallet: { signBytes },
          commitment: midenWalletSession.commitment,
          scheme: midenWalletSession.scheme,
          publicKey: midenWalletSession.publicKey ?? undefined,
        },
      };
    }
    return undefined;
  }, [
    walletSource,
    paraSession,
    paraClient,
    getWalletId,
    midenWalletSession,
    signBytes,
    ledger.signer,
  ]);

  // Guardian sessions (guardianSession.ts): one approval, then Guardian reads
  // and proposal requests stop prompting. The manager holds every session of
  // the connected wallet on this Guardian; another wallet or Guardian, or
  // logout, ends them all.
  const [guardianSession, setGuardianSession] = useState<GuardianSessionState>({ phase: "off" });
  const [sessionGrantPrompt, setSessionGrantPrompt] = useState<SessionGrantPrompt | null>(null);
  const grantAnswer = useRef<{ id: number; resolve: (approved: boolean) => void } | null>(null);
  const grantPromptId = useRef(0);
  const answerSessionGrant = useCallback((id: number, approved: boolean) => {
    const pending = grantAnswer.current;
    if (!pending || pending.id !== id) return;
    grantAnswer.current = null;
    setSessionGrantPrompt(null);
    pending.resolve(approved);
  }, []);
  const cancelSessionGrant = useCallback(() => {
    const pending = grantAnswer.current;
    grantAnswer.current = null;
    setSessionGrantPrompt(null);
    pending?.resolve(false);
  }, []);
  const confirmSessionGrant = useCallback((grant: SessionGrantFields) => new Promise<boolean>((resolve) => {
    grantAnswer.current?.resolve(false);
    const id = ++grantPromptId.current;
    grantAnswer.current = { id, resolve };
    setSessionGrantPrompt({ id, rows: sessionGrantRows(grant) });
  }), []);
  const [sessions] = useState(() => new GuardianSessionManager({
    confirm: confirmSessionGrant,
    cancelConfirm: cancelSessionGrant,
    onState: setGuardianSession,
  }));

  const sessionKeyFor = useCallback((url: string) =>
    activeCommitment && walletUsesSessions(walletSource)
      ? `${walletSource}|${activeCommitment.toLowerCase()}|${normalizeGuardianUrl(url) ?? url}`
      : null,
  [activeCommitment, walletSource]);
  const walletSessionKey = sessionKeyFor(guardianUrl);
  // Another wallet or Guardian (or a disconnected wallet) ends the sessions.
  useEffect(() => {
    void sessions.setWallet(walletSessionKey);
  }, [sessions, walletSessionKey]);

  /**
   * Resumes this wallet's session on `guardian`, or starts one (one approval),
   * before an account is loaded or right after one is created: Guardian grants
   * sessions only to a cosigner, and the requests that follow then need no
   * wallet. Never throws; a failure leaves the wallet signing.
   */
  const openGuardianSession = useCallback(async (guardian: GuardianHttpClient, walletSigner: Signer, url: string) => {
    const key = sessionKeyFor(url);
    if (!key) return;
    await sessions.setWallet(key);
    await sessions.ensure(guardian, walletSigner);
  }, [sessions, sessionKeyFor]);

  // A loaded account of this wallet may use its own Guardian client object:
  // put the stored session on it too (no prompt). An account that moved to
  // another Guardian (a switch_guardian execute) ends this Guardian's sessions.
  useEffect(() => {
    if (!multisig || !walletSessionKey || sessions.walletKey !== walletSessionKey) return;
    if (multisig.signerCommitment.toLowerCase() !== activeCommitment?.toLowerCase()) return;
    const guardian = multisigGuardian(multisig);
    if ((normalizeGuardianUrl(guardianEndpoint(guardian)) ?? "") !== (normalizeGuardianUrl(guardianUrl) ?? guardianUrl)) {
      void sessions.endAll();
      return;
    }
    if (sessions.holds(guardian)) return;
    try {
      void sessions.resume(guardian, createSigner(signer, activeScheme, buildExternalParams()));
    } catch {
      /* the wallet is not ready: its requests keep using the wallet */
    }
  }, [multisig, walletSessionKey, sessions, activeCommitment, guardianUrl, signer, activeScheme, buildExternalParams]);

  /** "Start session" in the signer chip, after a decline, failure or expiry. */
  const startGuardianSession = useCallback(async () => {
    const ownAccount = multisig && multisig.signerCommitment.toLowerCase() === activeCommitment?.toLowerCase();
    const guardian = ownAccount ? multisigGuardian(multisig) : clientPartsRef.current?.multisigClient.guardianClient;
    if (!guardian) return;
    let walletSigner: Signer;
    try {
      walletSigner = createSigner(signer, activeScheme, buildExternalParams());
    } catch (err) {
      setGuardianSession({ phase: "failed", message: formatError(err) });
      return;
    }
    await openGuardianSession(guardian, walletSigner, guardianUrl);
  }, [multisig, activeCommitment, signer, activeScheme, buildExternalParams, openGuardianSession, guardianUrl]);

  /** Logout: every stored session key of this site is deleted, then every session is revoked. */
  const endGuardianSession = useCallback(async () => {
    await forgetAllSessionKeys();
    await sessions.endAll();
  }, [sessions]);

  const connectToGuardian = useCallback(
    async (url: string, clientParam?: MidenClient): Promise<GuardianConnectResult> => {
      // `accountAffected` is false when the app is still on its working
      // Guardian: the caller shows the reason, the account banner stays clear.
      const fail = (message: string, accountAffected = true): GuardianConnectResult => {
        if (accountAffected) setError(message);
        return { ok: false, error: message };
      };
      if (!url.trim()) {
        setGuardianStatus("error");
        return fail("Set NEXT_PUBLIC_GUARDIAN_ENDPOINT to a Guardian 0.18 endpoint on the same Miden network.");
      }
      // A URL the CSP blocks would only fail as an opaque network error; keep
      // the current Guardian and say why instead.
      const blocked = deployedGuardianUrlProblem(url);
      if (blocked) return fail(blocked, !multisigClient);
      url = normalizeGuardianUrl(url) ?? url;
      setGuardianStatus("connecting");
      setError(null);
      try {
        const mc = clientParam ?? midenClient;
        if (!mc) {
          // No MidenClient yet — fetch pubkey directly from Guardian HTTP API
          const { GuardianHttpClient } =
            await import("@openzeppelin/guardian-client");
          const guardianHttp = new GuardianHttpClient(url);
          const pubkeyResp = await guardianHttp.getPubkey();
          setGuardianCommitment(pubkeyResp.commitment ?? "");
          setGuardianPublicKey(pubkeyResp.pubkey);
          setGuardianStatus("connected");
          setGuardianUrl(url);
          return { ok: true };
        }

        const {
          client: msClient,
          guardianCommitment: commitment,
          guardianPubkey: pubkey,
        } = await initMultisigClient(mc, url);
        setGuardianCommitment(commitment);
        setGuardianPublicKey(pubkey);
        setMultisigClient(msClient);
        setGuardianStatus("connected");
        // A start-up error from an earlier failed connection no longer applies.
        setStartupError(null);
        // The app now talks to this Guardian, whatever happens to the account below.
        setGuardianUrl(url);

        if (multisig && guardianState?.stateDataBase64) {
          setRegisteringOnGuardian(true);
          try {
            const clientSigner = createSigner(
              signer,
              walletSource === "ledger" ? "ecdsa" : signer?.activeScheme ?? activeScheme,
              buildExternalParams(),
            );
            // A session on this Guardian before reloading the account on it.
            await openGuardianSession(msClient.guardianClient, clientSigner, url);
            const reloadedMs = await loadMultisigAccount(
              msClient,
              multisig.accountId,
              clientSigner,
            );
            if (walletSource === "ledger" && clientSigner !== latestLedgerSigner.current) throw new Error("Ledger session changed; load the account again.");
            setMultisig(reloadedMs);

            await refreshAccount(reloadedMs);
            toast.success("Account loaded from Guardian");
          } catch (loadErr) {
            const isNotFound =
              loadErr instanceof GuardianHttpError && loadErr.status === 404;
            const isNonceTooLow =
              loadErr instanceof Error &&
              loadErr.message.includes("nonce") &&
              loadErr.message.includes("too low");

            if (isNotFound || isNonceTooLow) {
              try {
                // The account is not (or not currently) on the new Guardian:
                // keep the old Guardian's pending note data, repoint, and
                // register the account there, as a switch execute would have.
                await multisig.preservePreSwitchProposalNotes();
                multisig.setGuardianClient(msClient.guardianClient);
                await multisig.registerOnGuardian();
                await refreshAccount(multisig);
                toast.success("Account registered on new Guardian");
              } catch (registerErr) {
                return fail(`Failed to register account on new Guardian: ${formatError(registerErr)}`);
              }
            } else {
              return fail(`Failed to load account from Guardian: ${formatError(loadErr)}`);
            }
          } finally {
            setRegisteringOnGuardian(false);
          }
        }
        return { ok: true };
      } catch (err) {
        const msg = formatError(err);
        // Switching failed before anything was replaced: keep the working Guardian.
        if (multisigClient && url !== guardianUrl) {
          setGuardianStatus("connected");
          return fail(`Could not connect to ${url}: ${msg}. Still using ${guardianUrl}.`, false);
        }
        setGuardianStatus("error");
        setGuardianCommitment("");
        setGuardianPublicKey(undefined);
        return fail(`Failed to connect to Guardian: ${msg}`);
      }
    },
    [midenClient, multisig, multisigClient, guardianUrl, signer, guardianState, buildExternalParams, walletSource, activeScheme, refreshAccount, openGuardianSession],
  );

  // Initialization. Starting the in-browser Miden client downloads and compiles
  // the SDK (tens of MB of WASM), so it can take a while on a first visit;
  // Create/Load wait for it (waitForClient) instead of failing.
  const connectToGuardianRef = useRef(connectToGuardian);
  connectToGuardianRef.current = connectToGuardian;
  const startClient = useCallback(async () => {
    setStartupBuilding(true);
    setStartupError(null);
    try {
      assertConfigured(CONFIG_ERRORS);
      // A retry after a Guardian failure keeps the client it already built: a
      // second client on the same store would leak the first, and a failed
      // second build could reset the store under it.
      let client = midenClientRef.current;
      if (!client) {
        // Holds the store's shared lock from before it is opened, so another
        // tab's reset cannot run while this one starts (see clientStartup.ts).
        client = await startHoldingStoreLock({
          create: () => createMidenClient(),
          reset: () => resetStoreExclusively(MIDEN_DB_NAME),
          sdkVersion: MIDEN_SDK_VERSION,
          network: async () => `${MIDEN_RPC_URL} genesis ${(await readNodeIdentity(MIDEN_RPC_URL)).genesis}`,
          onReset: (reason) => console.warn(`Resetting the Miden client's local data: ${reason}.`),
        });
        setMidenClient(client);
      }

      // Local keys need no Guardian: set them up first, so a Guardian failure
      // does not leave the app without a signer once it reconnects. Unreadable
      // keys are reported, but do not stop start-up: other signers still work.
      let keyProblem: string | null = null;
      if (LOCAL_KEYS_ENABLED && !signerRef.current) {
        setGeneratingSigner(true);
        try {
          let signerInfo = await loadSignerKeys();
          if (!signerInfo) {
            signerInfo = initSigner();
            await saveSignerKeys(signerInfo);
          }
          setSigner(signerInfo);
        } catch (keyError) {
          keyProblem = formatError(keyError, "Local keys unavailable");
          toast.error(keyProblem);
        }
      }

      const connected = await connectToGuardianRef.current(guardianUrl, client);
      if (!connected.ok) setStartupError(connected.error);
      // After connecting, which clears the account error.
      else if (keyProblem) setError(keyProblem);
    } catch (err) {
      const message = formatError(err, "Initialization failed");
      setStartupError(message);
      setError(message);
    } finally {
      setGeneratingSigner(false);
      setStartupBuilding(false);
    }
  }, [guardianUrl]);

  useEffect(() => {
    void startClient();
    // Start once on mount; retryClientStartup starts it again on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestAccountFunding = useCallback(
    async (targetMultisig?: Multisig, { waitInBackground = false } = {}): Promise<boolean> => {
      const account = targetMultisig ?? multisig;
      // The latest client: this may run from a click made during start-up.
      const liveClient = clientPartsRef.current?.midenClient ?? midenClient;
      if (!account || !liveClient) {
        throw new Error("The Miden client and multisig account must be ready before funding.");
      }

      fundingAccountId.current = account.accountId;
      const run = ++fundingRun.current;
      // Checked after every await: the user may have switched account, or a
      // newer attempt (Retry funding) may have taken over, meanwhile.
      const stillCurrent = () =>
        fundingRun.current === run &&
        fundingAccountId.current === account.accountId &&
        multisigRef.current?.accountId === account.accountId;
      const failureKey = account.accountId.toLowerCase();
      const failurePrefix = fundsOnRegistration(MIDEN_NETWORK) ? "Account funding failed" : "Node registration failed";
      // This runs in the background: a failure after the user switched away is
      // kept, and shown (with Retry funding) when the account is loaded again.
      const recordFailure = (message: string) => {
        fundingFailures.current.set(failureKey, message);
        if (multisigRef.current?.accountId !== account.accountId) {
          toast.error(`Account ${account.accountId.slice(0, 10)}…: ${message}`);
        }
      };
      if (invitationCodeRequired(MIDEN_NETWORK) && !invitationCodes.current.get(account.accountId)?.trim()) {
        setAccountFunding({ phase: "error", message: CODE_NEEDED, needsInvitationCode: true });
        return false;
      }
      setAccountFunding({ phase: "registering" });
      try {
        await registerAccountOnNode(liveClient, account.accountId, invitationCodes.current.get(account.accountId));
        fundingFailures.current.delete(failureKey);
        if (!stillCurrent()) return false;
        // Only testnet funds a new account on registration; elsewhere there is
        // no funding note to wait for.
        if (!fundsOnRegistration(MIDEN_NETWORK)) {
          setAccountFunding({ phase: "idle" });
          toast.success("Account registered on the network");
          return false;
        }
        // The funding note can take a few minutes to arrive. Wait for it in the
        // background when asked, so other work is not held up. The wait is
        // bounded (fundingWait.ts); the SDK queues these syncs with the user's
        // own calls, so polling cannot overlap them.
        const waitForNote = async () => {
          setAccountFunding({ phase: "waiting-for-note" });
          let feeFaucetHex: string | undefined;
          const outcome = await waitForFundingNote({
            isCurrent: stillCurrent,
            check: async () => {
              // The funding note is public: chain state is enough, without the
              // note transport fetch that sync() adds (and fails on).
              await liveClient.syncChain();
              // Known only once the store has synced (SDK feeFaucetId).
              if (!feeFaucetHex) {
                const feeFaucet = await liveClient.feeFaucetId();
                feeFaucetHex = feeFaucet.toString().toLowerCase();
                feeFaucet.free();
              }
              const notes = await account.getConsumableNotes();
              if (!stillCurrent()) return false;
              // Only when the list changed: a new array on every poll would
              // re-render every consumer of this context.
              setConsumableNotes((current) =>
                current.length === notes.length && current.every((n, i) => n.id === notes[i].id) ? current : notes);
              return notes.some(note => note.assets.some(asset =>
                asset.faucetId.toLowerCase() === feeFaucetHex && asset.amount > 0n));
            },
          });
          if (outcome !== "found" || !stillCurrent()) return false;
          setAccountFunding({ phase: "funding-available" });
          return true;
        };
        if (!waitInBackground) return await waitForNote();
        void waitForNote().catch((waitError) => {
          const message = formatError(waitError, failurePrefix);
          recordFailure(message);
          if (stillCurrent()) setAccountFunding({ phase: "error", message });
        });
        return false;
      } catch (fundingError) {
        const message = formatError(fundingError, failurePrefix);
        recordFailure(message);
        if (!stillCurrent()) return false;
        setAccountFunding({ phase: "error", message });
        throw fundingError;
      }
    },
    [midenClient, multisig],
  );

  const retryAccountFunding = useCallback(async () => {
    try {
      // False when superseded (e.g. the user switched account meanwhile).
      if (await requestAccountFunding()) toast.success("Funding note is ready to receive");
    } catch (fundingError) {
      toast.error(formatError(fundingError, "Account funding failed"));
    }
  }, [requestAccountFunding]);

  const registerWithInvitationCode = useCallback(async (code: string) => {
    const ms = multisig;
    const liveClient = clientPartsRef.current?.midenClient ?? midenClient;
    const trimmed = code.trim();
    if (!ms || !liveClient || !trimmed) return;
    try {
      // Checked with the node first where it can, like at create.
      await assertInvitationCodeValid(liveClient.accounts, trimmed);
      invitationCodes.current.set(ms.accountId, trimmed);
      await requestAccountFunding(ms, { waitInBackground: true });
    } catch (registrationError) {
      // Rejected: ask for the code again rather than retrying a bad one.
      invitationCodes.current.delete(ms.accountId);
      if (multisigRef.current !== ms) return;
      const message = operationErrorMessage(registrationError, (e) => formatError(e, "Node registration failed"));
      setAccountFunding({ phase: "error", message, needsInvitationCode: invitationCodeRequired(MIDEN_NETWORK) });
    }
  }, [multisig, midenClient, requestAccountFunding]);

  const handleCreate = useCallback(
    async (
      otherSignerCommitments: string[],
      threshold: number,
      procedureThresholds?: ProcedureThreshold[],
      signatureScheme: SignatureScheme = walletSource === "ledger" ? "ecdsa" : "falcon",
      options?: { invitationCode?: string },
    ) => {
      if (invitationCodeRequired(MIDEN_NETWORK) && !options?.invitationCode?.trim()) {
        const msg = "Enter the invitation code to register the account on this network.";
        setError(msg);
        throw new Error(msg);
      }
      if (!guardianUrl.trim()) {
        const msg = "Set NEXT_PUBLIC_GUARDIAN_ENDPOINT to a Guardian 0.18 endpoint on the same Miden network.";
        setError(msg);
        throw new Error(msg);
      }
      // Wait for start-up rather than failing a click that came in during it.
      setCreating(true);
      let ready;
      try {
        ready = await waitForClient();
      } catch (startupErr) {
        setCreating(false);
        const msg = formatError(startupErr);
        setError(msg);
        throw startupErr;
      }
      const { multisigClient, guardianCommitment, midenClient } = ready;

      setGuardianRegistrationRequired(false);
      setError(null);
      try {
        // A required invitation code is checked with the node first, so a
        // mistyped one is corrected before an account exists that cannot register.
        if (invitationCodeRequired(MIDEN_NETWORK)) {
          await assertInvitationCodeValid(midenClient.accounts, options?.invitationCode?.trim() ?? "");
        }
        setSigner((prev) =>
          prev ? { ...prev, activeScheme: signatureScheme } : prev,
        );
        let ackPublicKey = guardianPublicKey;
        let accountGuardianCommitment = guardianCommitment;
        if (signatureScheme === "ecdsa") {
          const pubkeyResp =
            await multisigClient.guardianClient.getPubkey("ecdsa");
          if (!ackPublicKey) {
            ackPublicKey = pubkeyResp.pubkey;
            setGuardianPublicKey(pubkeyResp.pubkey);
          }
          accountGuardianCommitment = pubkeyResp.commitment;
          setGuardianCommitment(pubkeyResp.commitment);
        }

        const externalParams = buildExternalParams();
        const clientSigner = createSigner(
          signerRef.current,
          signatureScheme,
          externalParams,
        );
        const signerCommitment =
          externalParams?.ledgerSigner?.commitment ??
          externalParams?.paraContext?.commitment ??
          externalParams?.midenWalletContext?.commitment ??
          clientSigner.commitment;

        const ms = await createMultisigAccount(
          multisigClient,
          signerCommitment,
          otherSignerCommitments,
          threshold,
          accountGuardianCommitment,
          clientSigner,
          ackPublicKey,
          procedureThresholds,
          signatureScheme,
        );
        if (walletSource === "ledger" && clientSigner !== latestLedgerSigner.current) throw new Error("Ledger session changed; load the account again.");
        setMultisig(ms);
        if (options?.invitationCode?.trim()) invitationCodes.current.set(ms.accountId, options.invitationCode.trim());

        // Persist account ID so middleware allows dashboard access
        if (ms.accountId) {
          localStorage.setItem("currentWalletId", ms.accountId);
          localStorage.setItem("currentWalletSource", walletSource);
          localStorage.setItem("currentWalletScheme", signatureScheme);
          setWalletCookie(ms.accountId);
        }

        setRegisteringOnGuardian(true);
        let registeredOnGuardian = false;
        try {
          setGuardianRegistrationRequired(true);
          await ms.registerOnGuardian();
          registeredOnGuardian = true;
          setGuardianRegistrationRequired(false);
          // Guardian grants sessions only to a cosigner: the first chance is now.
          await openGuardianSession(multisigGuardian(ms), clientSigner, guardianUrl);
          if (midenClient && ms.accountId) {
            await watchAccountNotes(midenClient, ms.accountId);
            // Node registration and the funding wait run in the background: a
            // slow node must not hold up creation (the account already exists
            // and is on Guardian). Failures show in the funding banner.
            void requestAccountFunding(ms, { waitInBackground: true }).catch(() => {});
            try {
              await midenClient.sync();
            } catch {
              /* non-fatal */
            }
            await fetchPrivateNotes(midenClient);
          }
          await refreshAccount(ms);
        } catch (guardianErr) {
          setError(
            `${registeredOnGuardian ? "Registered on Guardian but failed to sync" : "Created but failed to register on Guardian"}: ${guardianErr instanceof Error ? guardianErr.message : "Unknown"}`,
          );
        } finally {
          setRegisteringOnGuardian(false);
        }
      } catch (err) {
        setError(operationErrorMessage(err, (e) =>
          walletSource !== "local" ? classifyWalletError(e) : formatError(e, "Failed to create")));
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [
      waitForClient,
      refreshAccount,
      guardianUrl,
      guardianPublicKey,
      walletSource,
      buildExternalParams,
      requestAccountFunding,
      openGuardianSession,
    ],
  );

  const handleLoad = useCallback(
    async (accountId: string, signatureScheme: SignatureScheme = walletSource === "ledger" ? "ecdsa" : "falcon") => {
      if (!guardianUrl.trim()) {
        const msg = "Set NEXT_PUBLIC_GUARDIAN_ENDPOINT to a Guardian 0.18 endpoint on the same Miden network.";
        setError(msg);
        throw new Error(msg);
      }
      // Wait for start-up rather than failing a click that came in during it.
      setLoadingAccount(true);
      let ready;
      try {
        ready = await waitForClient();
      } catch (startupErr) {
        setLoadingAccount(false);
        const msg = formatError(startupErr);
        setError(msg);
        throw startupErr;
      }
      const { multisigClient, midenClient } = ready;

      let normalizedId = accountId;
      if (!normalizedId.startsWith("0x")) {
        normalizedId = `0x${normalizedId}`;
      }

      setLoadingAccount(true);
      setMultisig(null);
      setGuardianRegistrationRequired(false);
      setError(null);
      setDetectedConfig(null);
      try {
        setSigner((prev) =>
          prev ? { ...prev, activeScheme: signatureScheme } : prev,
        );

        const externalParams = buildExternalParams();
        const clientSigner = createSigner(
          signerRef.current,
          signatureScheme,
          externalParams,
        );

        // The Guardian session first (none on a reload, at most one approval),
        // so the load's own Guardian requests need no wallet: on Ledger they
        // would otherwise queue behind the grant on the device.
        await openGuardianSession(multisigClient.guardianClient, clientSigner, guardianUrl);

        let pendingRegistration = false;
        const ms = await loadMultisigAccount(
          multisigClient,
          normalizedId,
          clientSigner,
        ).catch(async (err: unknown) => {
          if (!(err instanceof GuardianHttpError) || err.code !== "account_not_found" || !midenClient) throw err;
          const pending = await loadPendingMultisigAccount(multisigClient, midenClient, normalizedId, clientSigner);
          pendingRegistration = true;
          setGuardianRegistrationRequired(true);
          return pending;
        });
        if (walletSource === "ledger" && clientSigner !== latestLedgerSigner.current) throw new Error("Ledger session changed; load the account again.");
        setMultisig(ms);

        // Persist account ID so middleware allows dashboard access
        if (ms.accountId) {
          localStorage.setItem("currentWalletId", ms.accountId);
          localStorage.setItem("currentWalletSource", walletSource);
          localStorage.setItem("currentWalletScheme", signatureScheme);
          setWalletCookie(ms.accountId);
        }

        if (pendingRegistration) {
          setError("This account is saved locally but is not registered on Guardian. Retry Guardian registration.");
          return;
        }

        if (midenClient && ms.accountId) {
          await watchAccountNotes(midenClient, ms.accountId);
          try {
            await midenClient.sync();
          } catch {
            /* non-fatal */
          }
          await fetchPrivateNotes(midenClient);
        }

        await refreshAccount(ms);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown";
        if (err instanceof GuardianHttpError && err.code === "account_not_found") {
          setGuardianRegistrationRequired(true);
        }
        if (message.includes("404") || message.includes("not found")) {
          setError("Account not found on Guardian");
        } else {
          setError(`Failed to load: ${message}`);
        }
        throw err;
      } finally {
        setLoadingAccount(false);
      }
    },
    [
      waitForClient,
      refreshAccount,
      guardianUrl,
      walletSource,
      buildExternalParams,
      openGuardianSession,
    ],
  );

  // Auto-load saved account after initialization completes
  const autoLoadAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoLoadAttemptedRef.current) return;
    if (!multisigClient || !guardianCommitment) return;

    const savedId = localStorage.getItem("currentWalletId");
    if (!savedId) return;
    // Just created or loaded in this session: reloading would replace the
    // account (and cancel work bound to it, such as the funding wait).
    if (multisigRef.current?.accountId.toLowerCase() === savedId.toLowerCase()) {
      autoLoadAttemptedRef.current = true;
      return;
    }

    const savedSource = localStorage.getItem(
      "currentWalletSource",
    ) as WalletSource | null;
    const savedScheme = localStorage.getItem(
      "currentWalletScheme",
    ) as SignatureScheme | null;

    if (savedSource === "ledger" || walletSource === "ledger") return;
    if ((savedSource ?? walletSource) === "local" && (!LOCAL_KEYS_ENABLED || !signer)) return;
    if (savedSource === "para" && !paraSession.connected) return;
    if (savedSource === "miden-wallet" && !midenWalletSession.connected) return;
    autoLoadAttemptedRef.current = true;

    if (savedSource && savedSource !== walletSource) {
      setWalletSource(savedSource);
    }

    setTimeout(() => {
      handleLoad(savedId, savedScheme ?? "falcon");
    }, 100);
  }, [
    setWalletSource,
    multisigClient,
    signer,
    guardianCommitment,
    handleLoad,
    paraSession.connected,
    midenWalletSession.connected,
    walletSource,
  ]);

  const handleSync = useCallback(async () => {
    if (!multisig || !midenClient) return;

    setSyncingState(true);
    setError(null);
    setPendingCandidateWarning(null);
    try {
      if (multisig.accountId) {
        await watchAccountNotes(midenClient, multisig.accountId);
      }
      // Guardian's account state is synced even when the chain sync fails
      // (e.g. the note transport is down): proposals are labelled with this
      // state's nonce, and a stale one would reuse a nonce already taken.
      let chainError: unknown = null;
      try {
        await midenClient.sync();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await midenClient.sync().catch((err: unknown) => { chainError = err; });
      }
      if (!chainError) await fetchPrivateNotes(midenClient);

      const state = await retryIfSessionDied(() => multisig.syncState()).catch((err: unknown) => {
        if (err instanceof GuardianHttpError && err.code === "account_not_found") {
          setGuardianRegistrationRequired(true);
        }
        throw err;
      });
      setGuardianRegistrationRequired(false);
      await refreshAccount(multisig, state);
      if (chainError) throw chainError;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (await handleLocalStateAhead(multisig, message)) {
        setError(null);
      } else {
        setError(formatError(err, "Sync failed"));
      }
    } finally {
      setSyncingState(false);
    }
  }, [multisig, midenClient, refreshAccount, handleLocalStateAhead]);

  const retryGuardianRegistration = useCallback(async () => {
    if (!multisig || !midenClient || !guardianRegistrationRequired || registrationRetryInProgress.current) return;
    if (walletSource === "ledger" && !ledger.signer) {
      setError("Reconnect the Ledger signer before retrying Guardian registration.");
      return;
    }

    registrationRetryInProgress.current = true;
    setRegisteringOnGuardian(true);
    setError(null);
    try {
      const signerAtStart = ledger.signer;
      const result = await runRegistrationRetry({
        register: () => multisig.registerOnGuardian(),
        sessionUnchanged: () => walletSource !== "ledger" || signerAtStart === latestLedgerSigner.current,
        registerNoteTag: () => registerAccountNoteTag(midenClient, multisig.accountId),
        // Node registration and the funding note run in the background, like at
        // create. An account already on chain was registered before: skip it.
        requestFunding: async () => {
          const account = await midenClient.accounts.get(multisig.accountId);
          if (account && account.nonce().asInt() !== 0n) return;
          void requestAccountFunding(multisig, { waitInBackground: true }).catch(() => {});
        },
        sync: handleSync,
      });
      if (result.registered) setGuardianRegistrationRequired(false);
      if (result.error) setError(formatError(result.error, "Guardian registration recovery failed"));
    } finally {
      registrationRetryInProgress.current = false;
      setRegisteringOnGuardian(false);
    }
  }, [multisig, midenClient, guardianRegistrationRequired, walletSource, ledger.signer, requestAccountFunding, handleSync]);

  // Re-sync (which re-verifies every proposal), then report this proposal's result.
  const retryProposalVerification = useCallback(
    async (proposalId: string) => {
      if (!multisig) return;
      await handleSync();
      const proposal = multisig.listProposals().find((item) => item.id === proposalId);
      if (!proposal) {
        toast.info("The proposal is no longer on Guardian.");
      } else if (proposal.verification.status === "failed") {
        toast.error(`Still not verified: ${proposal.verification.message}`);
      } else if (proposal.verification.status === "verified") {
        toast.success("Proposal verified");
      }
    },
    [handleSync, multisig],
  );

  const automaticVerificationRetries = useRef(new Set<string>());
  useEffect(() => {
    for (const proposal of proposals) {
      if (
        proposal.verification.status === "verified"
        || proposal.verification.status === "failed" && !proposal.verification.retryable
        || proposal.status === "finalized"
      ) {
        automaticVerificationRetries.current.delete(proposal.id);
      }
    }

    const retryable = proposals.filter(
      (proposal) =>
        proposal.verification.status === "failed"
        && proposal.verification.retryable
        && !automaticVerificationRetries.current.has(proposal.id),
    );
    if (retryable.length === 0 || syncingState || walletSource === "ledger") return;

    retryable.forEach((proposal) => automaticVerificationRetries.current.add(proposal.id));
    void handleSync();
  }, [handleSync, proposals, syncingState, walletSource]);

  /** On a 409, ask Guardian which open proposal holds the lock and since when. */
  const inspectAccountLock = useCallback(async (ms: Multisig) => {
    const stillCurrent = () => multisigRef.current === ms;
    let proposals: Proposal[];
    try {
      proposals = await ms.syncProposals();
    } catch {
      proposals = ms.listProposals();
    }
    const lookup = await findLockedCandidate(ms, proposals);
    if (!stillCurrent()) return;
    if (lookup.kind === "found") {
      setLockedCandidate({ ...lookup.candidate, accountId: ms.accountId });
      setPendingCandidateWarning(null);
    } else if (lookup.kind === "none") {
      setLockedCandidate(null);
      setPendingCandidateWarning(
        "Guardian reported a pending execution for this account that is no longer pending. Sync and try again.",
      );
    } else {
      setLockedCandidate(null);
      setPendingCandidateWarning(
        "Another execution holds this account's lock and Guardian could not be asked which one. " +
          "Guardian releases stale locks automatically within about 20 minutes; try again then.",
      );
    }
  }, []);

  /**
   * The one contract every proposal handler follows: resolves with the created
   * proposal, or rejects after reporting why. Success UI must only run after it
   * resolves. A transient Guardian failure while submitting is retried with the
   * same data (see proposalSubmission.ts); a 409 shows the account's lock.
   */
  const runProposalCreation = useCallback(
    async <T,>(label: string, create: (ms: Multisig) => Promise<T>): Promise<T> => {
      const ms = multisig;
      if (!ms) throw new Error("Load an account first");
      setCreatingProposal(true);
      setError(null);
      setPendingCandidateWarning(null);
      try {
        await ensurePrivateNotesClearRef.current(ms);
        // Bring the client to the chain tip first. Building a proposal executes
        // the transaction, which loads foreign accounts (the fee faucet) at the
        // store's sync height, and the node prunes that state after about 50
        // blocks: a tab left unsynced for a few minutes otherwise fails with
        // "before_foreign_load". The multisig client syncs before executing a
        // proposal, but not before creating one.
        const liveClient = clientPartsRef.current?.midenClient ?? midenClient;
        if (liveClient) {
          // Once more on a transient failure, as the multisig client does.
          await liveClient.syncChain().catch(async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
            await liveClient.syncChain();
          });
        }
        // And to Guardian's account state: 0.18.1 labels a proposal with the
        // local account's nonce + 1, so a tab that missed another cosigner's
        // execute would label it with a nonce already taken, and it could
        // never execute.
        await retryIfSessionDied(() => ms.syncState());
        if (multisigRef.current === ms) setAccountNonce(ms.account.nonce().asInt());
        const created = await create(ms);
        if (multisigRef.current === ms) setProposals(ms.listProposals());
        toast.success(`${label} proposal created`);
        return created;
      } catch (err) {
        if (multisigRef.current === ms) {
          if (isPendingCandidateError(err)) {
            await inspectAccountLock(ms);
          } else {
            setError(operationErrorMessage(err, (e) => describeExecutionError(e, `Failed to create the ${label.toLowerCase()} proposal`)));
          }
        }
        throw err;
      } finally {
        setCreatingProposal(false);
      }
    },
    [multisig, midenClient, inspectAccountLock],
  );

  const handleCreateAddSignerProposal = useCallback(
    async (commitment: string, increaseThreshold: boolean) => {
      let normalizedCommitment: string;
      try {
        normalizedCommitment = normalizeCommitment(commitment);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Invalid commitment";
        setError(message);
        throw new Error(message);
      }
      await runProposalCreation("Add signer", (ms) =>
        ms.createAddSignerProposal(normalizedCommitment, {
          newThreshold: increaseThreshold ? ms.threshold + 1 : undefined,
        }),
      );
    },
    [runProposalCreation],
  );

  const handleCreateRemoveSignerProposal = useCallback(
    async (signerToRemove: string, newThreshold?: number) => {
      await runProposalCreation("Remove signer", (ms) =>
        ms.createRemoveSignerProposal(signerToRemove, { newThreshold }),
      );
    },
    [runProposalCreation],
  );

  const handleCreateChangeThresholdProposal = useCallback(
    async (newThreshold: number) => {
      await runProposalCreation("Change threshold", (ms) => ms.createChangeThresholdProposal(newThreshold));
    },
    [runProposalCreation],
  );

  const handleCreateProcedureThresholdProposal = useCallback(
    async (procedure: ProcedureName, threshold: number) => {
      await runProposalCreation("Procedure threshold", (ms) =>
        ms.createUpdateProcedureThresholdProposal(procedure, threshold),
      );
    },
    [runProposalCreation],
  );

  const handleCreateConsumeNotesProposal = useCallback(
    async (noteIds: string[]) => {
      const selectedNotes = consumableNotes.filter((n) => noteIds.includes(n.id));
      try {
        await runProposalCreation("Receive", async (ms) => {
          if (midenClient) await logReceiveFunding(midenClient, ms, selectedNotes);
          return ms.createConsumeNotesProposal(noteIds);
        });
      } catch (err) {
        diagnosticLog('receive.FAIL', { accountId: multisig?.accountId, noteIds, error: diagnosticError(err) });
        throw err;
      }
      if (accountFunding.phase === "funding-available") {
        setAccountFunding({ phase: "idle" });
      }
    },
    [accountFunding.phase, multisig, consumableNotes, midenClient, runProposalCreation],
  );

  const handleCreateP2idProposal = useCallback(
    async (recipientId: string, faucetId: string, amount: bigint) => {
      await runProposalCreation("Send", (ms) => ms.createP2idProposal(recipientId, faucetId, amount));
    },
    [runProposalCreation],
  );

  const handleCreateAdminProposal = useCallback(
    async (
      recipe: Omit<AdminRecipe, "saltHex" | "boundBlockNum" | "noteIdHex"> &
        Partial<Pick<AdminRecipe, "saltHex" | "boundBlockNum">>,
    ) => {
      await runProposalCreation(`${profileOf(recipeTarget(recipe)).labels.contractShort} ${recipe.action}`, async (ms) => {
        if (!midenClient) throw new Error("Load an account first");
        const draft: AdminRecipe = {
          ...recipe,
          saltHex: recipe.saltHex ?? "",
          boundBlockNum: recipe.boundBlockNum ?? 0,
        };
        const built = await buildAdminTransactionRequest(midenClient, draft);
        const noteIdHex = Note.deserialize(buildAdminNoteBytes(built.recipe))
          .id()
          .toString();
        return createAdminProposalWith(ms, built, noteIdHex);
      });
    },
    [runProposalCreation, midenClient],
  );

  const handleDirectAdminAction = useCallback(
    async (recipe: Omit<AdminRecipe, "saltHex" | "boundBlockNum" | "noteIdHex">): Promise<string> => {
      if (walletSource !== "miden-wallet" || !midenWalletSession.connected || !midenWalletSession.address) {
        throw new Error("Connect Bread first");
      }
      const built = await buildDirectAdminTransactionRequest({ ...recipe, saltHex: "", boundBlockNum: 0 });
      return submitDirectAdminAction(midenWalletAdapter, midenWalletSession.address, built);
    },
    [walletSource, midenWalletSession, midenWalletAdapter],
  );

  // Creates the private send proposal only. The note is delivered after the
  // transaction lands (the note transport needs its inclusion proof): see
  // handleExecuteProposal and the private-note guard (privateNoteGuard.ts),
  // which blocks the account until it is delivered or consumed.
  const handleSendPrivateNote = useCallback(
    async (recipientId: string, faucetId: string, amount: bigint) => {
      setPrivateSendProgress({ step: "creating-proposal", totalNotes: 0, relayedNotes: 0 });
      try {
        await runProposalCreation("Private send", (ms) =>
          ms.createP2idProposal(recipientId, faucetId, amount, { noteType: NoteType.Private }),
        );
        setPrivateSendProgress((prev) => ({ ...prev, step: "done" }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setPrivateSendProgress((prev) => ({ ...prev, step: "error", error: message }));
        throw err;
      }
    },
    [runProposalCreation],
  );

  const resetPrivateSendProgress = useCallback(() => {
    setPrivateSendProgress({ step: "idle", totalNotes: 0, relayedNotes: 0 });
  }, []);

  const handleCreateSwitchGuardianProposal = useCallback(
    async (newEndpoint: string, newPubkey: string) => {
      // Checked before the lock check and sync, which on Ledger cost approvals.
      const problem = deployedGuardianUrlProblem(newEndpoint);
      if (problem) {
        setError(problem);
        throw new UserFacingError(problem);
      }
      const endpoint = normalizeGuardianUrl(newEndpoint) ?? newEndpoint;
      await runProposalCreation("Switch Guardian", (ms) => ms.createSwitchGuardianProposal(endpoint, newPubkey));
    },
    [runProposalCreation],
  );

  const handleSignProposal = useCallback(
    async (proposalId: string) => {
      if (!multisig) return;

      setSigningProposal(proposalId);
      setError(null);
      try {
        // Checked on the cached proposal first: the lock check and the sync
        // below are signed Guardian requests (device approvals on Ledger).
        const cached = multisig.listProposals().find((proposal) => proposal.id === proposalId);
        const blockedSwitch = cached && switchGuardianProblem(cached);
        if (blockedSwitch) throw new UserFacingError(blockedSwitch);
        await ensurePrivateNotesClearRef.current(multisig);
        const synced = await multisig.syncProposals();
        setProposals(synced);
        const fresh = synced.find((proposal) => proposal.id === proposalId);
        if (!fresh) throw new Error("Proposal no longer exists on Guardian.");
        const unreachable = switchGuardianProblem(fresh);
        if (unreachable) throw new UserFacingError(unreachable);
        const action = getProposalActionState(fresh, detectedConfig, activeCommitment, 0, accountNonce);
        if (action.action !== "sign") {
          throw new Error(action.statusLabel);
        }
        await multisig.signProposal(proposalId);
        setProposals(multisig.listProposals());
      } catch (err) {
        const message = operationErrorMessage(err, (e) =>
          walletSource !== "local"
            ? classifyWalletError(e)
            : `Failed to sign: ${e instanceof Error ? e.message : "Unknown"}`);
        setError(message);
        throw err;
      } finally {
        setSigningProposal(null);
      }
    },
    [activeCommitment, detectedConfig, multisig, walletSource, accountNonce],
  );

  const loadedAccountId = multisig?.accountId ?? null;

  // Locally-dismissed (cancelled) proposal ids, per account. The Guardian has no delete-proposal
  // API, so a stuck proposal that will never execute is hidden client-side; the account lock, if
  // any, is released via abandonCandidate in handleCancelProposal.
  useEffect(() => {
    if (!loadedAccountId || typeof window === "undefined") {
      setDismissedProposalIds(new Set());
      return;
    }
    try {
      const raw = window.localStorage.getItem(`dismissedProposals:${loadedAccountId}`);
      setDismissedProposalIds(new Set<string>(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setDismissedProposalIds(new Set());
    }
  }, [loadedAccountId]);

  // Fold every observed proposal into the durable per-account history (which
  // outlives Guardian's prune-on-execute), and surface it newest-first. Loading
  // an account with an empty proposal list still refreshes from storage, so
  // prior history shows immediately.
  useEffect(() => {
    if (!loadedAccountId) {
      setProposalHistory([]);
      return;
    }
    const map = recordObserved(loadedAccountId, proposals);
    setProposalHistory(historyEntries(map));
  }, [proposals, loadedAccountId]);

  // The account's on-chain history from the node. Besides feeding the History page, it is the
  // one record of execution that does not depend on which browser pressed Execute: a custom
  // (admin) proposal is never reported finalized by Guardian, so a proposal executed elsewhere
  // would otherwise sit in this browser's history as "pending" forever. Any pending proposal
  // whose admin note is on chain is marked executed here, with the transaction that carried it.
  const onChainHistory = useOnChainHistory(loadedAccountId, proposalHistory);
  const { executedOnChain, refresh: refreshOnChainHistory } = onChainHistory;
  useEffect(() => {
    if (!loadedAccountId || executedOnChain.length === 0) return;
    let map: ReturnType<typeof recordExecuted> | null = null;
    for (const m of executedOnChain) {
      map = recordExecuted(loadedAccountId, m.proposalId, m.txIdHex);
    }
    if (map) setProposalHistory(historyEntries(map));
  }, [executedOnChain, loadedAccountId]);

  const handleCancelProposal = useCallback(
    async (proposalId: string) => {
      const ms = multisigRef.current;
      if (!ms) return;
      setCancelingProposal(proposalId);
      try {
        const proposal = ms.listProposals().find((p) => p.id === proposalId);
        // Best-effort: if this proposal pushed a canonicalization candidate that will never land
        // (e.g. an execute that failed client-side), release the account lock. Harmless and
        // idempotent when there is no such candidate.
        if (proposal) {
          try {
            await ms.abandonCandidate(proposal.nonce);
            for (let i = 0; i < 8; i++) {
              const status = await ms.abandonStatus(proposal.nonce);
              if (status === "abandoned" || status === "landed") break;
              await new Promise((r) => setTimeout(r, 2000));
            }
          } catch {
            // Not a candidate, or already resolved — proceed to hide it locally regardless.
          }
        }
        setDismissedProposalIds((prev) => {
          const next = new Set(prev);
          next.add(proposalId);
          if (loadedAccountId && typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                `dismissedProposals:${loadedAccountId}`,
                JSON.stringify([...next]),
              );
            } catch {
              /* storage unavailable — dismissal is in-memory for this session */
            }
          }
          return next;
        });
        // Record the discard durably so it stays out of the counts and shows as
        // "Discarded" in history (this browser only — Guardian has no
        // cross-signer delete, so another signer discards on their own side).
        setProposalHistory(historyEntries(recordDiscarded(ms.accountId, proposalId)));
        try {
          setProposals(await ms.syncProposals());
        } catch {
          /* keep the current list if the refresh fails */
        }
        await refreshAccount(ms);
        toast.success("Request cancelled");
      } catch (err) {
        toast.error(`Failed to cancel: ${err instanceof Error ? err.message : "Unknown"}`);
      } finally {
        setCancelingProposal(null);
      }
    },
    [loadedAccountId, refreshAccount],
  );

  // Switching account starts a fresh session: nothing from the previous
  // account's lock, warnings or funding carries over. A background
  // registration that failed for the loaded account is offered again.
  useEffect(() => {
    setLockedCandidate(null);
    setPendingCandidateWarning(null);
    setReleasingCandidate(false);
    setUndeliveredNotes([]);
    setPrivateNoteGuard({ phase: "idle" });
    setAccountNonce(null);
    const fundingFailure = loadedAccountId ? fundingFailures.current.get(loadedAccountId.toLowerCase()) : undefined;
    if (fundingFailure && fundingAccountId.current !== loadedAccountId) {
      fundingAccountId.current = loadedAccountId;
      setAccountFunding({ phase: "error", message: fundingFailure });
    } else if (fundingAccountId.current && fundingAccountId.current !== loadedAccountId) {
      fundingAccountId.current = null;
      setAccountFunding({ phase: "idle" });
    }
  }, [loadedAccountId]);

  // On load: an account with no transaction yet must be registered on the node
  // before its first one (mainnet's allow-list), and only the node knows whether
  // it is. Ask it, so a loaded account, or one whose registration never
  // finished, can be registered from here. One node call, no wallet prompt;
  // skipped while create or a Retry is already registering it.
  useEffect(() => {
    const ms = multisigRef.current;
    const client = midenClientRef.current;
    if (!loadedAccountId || clientStartup.phase !== "ready" || creating || loadingAccount) return;
    if (!ms || !client || ms.accountId !== loadedAccountId || fundingAccountId.current === loadedAccountId) return;
    let cancelled = false;
    void nodeRegistrationMissing(client.accounts, ms.accountId).then((missing) => {
      if (!missing || cancelled || multisigRef.current !== ms || fundingAccountId.current === ms.accountId) return;
      fundingAccountId.current = ms.accountId;
      const needsInvitationCode = invitationCodeRequired(MIDEN_NETWORK) && !invitationCodes.current.get(ms.accountId)?.trim();
      setAccountFunding({ phase: "error", message: needsInvitationCode ? CODE_NEEDED : NOT_REGISTERED, needsInvitationCode });
    }).catch(() => {
      /* Unknown: nothing to show; registration reports its own errors. */
    });
    return () => {
      cancelled = true;
    };
  }, [loadedAccountId, clientStartup.phase, creating, loadingAccount]);

  // Deliver this account's pending private notes (see privateDelivery.ts):
  // right after execute with a long wait for the commit, and on load or retry
  // with a short one. A note stays pending until the transport accepts it, or
  // until it is clear its transaction did not commit (Guardian is then the source).
  // Deliveries in progress, by proposal: a later check, even one for a reloaded
  // account object, waits for a running delivery instead of skipping it.
  const deliveringNotes = useRef(new Map<string, Promise<void>>());
  // Private sends whose execution is still running in this tab.
  const executingSends = useRef(new Set<string>());
  const deliverPendingNotes = useCallback(async (accountId: string, timeoutMs: number, checks: NoteChainChecks) => {
    // Delivery needs only the Miden client (node and note transport), not
    // Guardian: read it directly, so it also works while Guardian is down.
    const client = midenClientRef.current;
    if (!client) return;
    for (const pending of pendingDeliveries(accountId)) {
      const running = deliveringNotes.current.get(pending.proposalId);
      if (running) {
        await running;
        continue;
      }
      const stillPending = () => pendingDeliveries(accountId).some((p) => p.proposalId === pending.proposalId);
      const forget = () => setUndeliveredNotes((all) => all.filter((n) => n.proposalId !== pending.proposalId));
      const delivery = (async () => {
        try {
          const notes = pending.notes.map((encoded) => decodeNote(encoded, (bytes) => Note.deserialize(bytes)));
          const outcome = await deliverCommittedNotes(client, notes, pending.recipientId, {
            fetchProof: checks.fetchProofById,
            stillPending,
            timeoutMs,
          });
          if (outcome === "dropped") return;
          removePendingDelivery(pending.proposalId);
          forget();
          toast.success("Private note delivered to the recipient");
        } catch (err) {
          // Its execute failed meanwhile and dropped the note: nothing was sent.
          if (!stillPending()) return;
          // Not on-chain although its execution is over: the node accepted the
          // transaction but has not committed it. Drop the copy and let Guardian
          // decide, as after a reload: its candidate lock holds the account (with
          // Unlock) until the transaction lands, then its canonical delta is delivered.
          if (err instanceof NoteNotOnChainError && !executingSends.current.has(pending.proposalId)) {
            removePendingDelivery(pending.proposalId);
            forget();
            return;
          }
          if (multisigRef.current?.accountId !== accountId) return;
          const error = formatError(err);
          setUndeliveredNotes((all) => [
            ...all.filter((n) => n.proposalId !== pending.proposalId),
            { proposalId: pending.proposalId, recipientId: pending.recipientId, error },
          ]);
        }
      })();
      deliveringNotes.current.set(pending.proposalId, delivery);
      try {
        await delivery;
      } finally {
        deliveringNotes.current.delete(pending.proposalId);
      }
    }
  }, []);

  // The guard (see privateNoteGuard.ts). One check per account object at a
  // time; callers that arrive while it runs share its result. Resolves with
  // the refusal for operations, or null when the account may be used.
  const privateNoteCheck = useRef<{ ms: Multisig; run: Promise<PrivateNoteBlockedError | null> } | null>(null);
  const checkPrivateNotes = useCallback(
    (ms: Multisig, localWaitMs = 60_000, { fresh = false } = {}): Promise<PrivateNoteBlockedError | null> => {
      const inFlight = privateNoteCheck.current;
      // A caller that needs the current state (after an execution) must not
      // join a check that started before it: run a new one after it instead.
      if (inFlight?.ms === ms && !fresh) return inFlight.run;
      const previous = inFlight?.ms === ms ? inFlight.run.catch(() => null) : Promise.resolve(null);
      const run = previous.then(async (): Promise<PrivateNoteBlockedError | null> => {
        const stillCurrent = () => multisigRef.current === ms;
        const report = (blocked: PrivateNoteBlockedError | null) => {
          if (!stillCurrent()) return blocked;
          setPrivateNoteGuard(
            blocked === null
              ? { phase: "clear" }
              : { phase: blocked.undelivered ? "blocked" : "unverified", error: blocked.reason },
          );
          // An operation refused while blocked left its error up; unlocking clears it.
          if (blocked === null) setError((current) => (isPrivateNoteBlockedMessage(current) ? null : current));
          return blocked;
        };
        // Once clear, stay shown as clear while re-checking (it runs before
        // every operation), unless a note from this tab is waiting to be
        // delivered: that check can take a while, so say what it waits for.
        if (stillCurrent()) {
          const delivering = pendingDeliveries(ms.accountId).length > 0;
          setPrivateNoteGuard((g) => (g.phase === "clear" && !delivering ? g : { phase: "checking" }));
        }
        // One node connection for every lookup of this check.
        const checks = noteChainChecks();
        try {
          // A private send executed in this tab, possibly not canonical yet.
          // Needs only the Miden client, so it runs even while Guardian is down.
          await deliverPendingNotes(ms.accountId, localWaitMs, checks);
          if (pendingDeliveries(ms.accountId).length > 0) {
            return report(new PrivateNoteBlockedError("A private note from the last send has not reached its recipient yet.", true));
          }
          // Reloaded meanwhile: the operation that asked belongs to the old
          // account object (and on Ledger, Guardian would prompt for nothing).
          if (!stillCurrent()) return new PrivateNoteBlockedError("The account was reloaded during the check. Try again.", false);
          const client = midenClientRef.current;
          if (!client) return report(new PrivateNoteBlockedError("The Miden client is not running.", false));
          // The latest canonical transaction, as Guardian keeps it: covers sends
          // executed by another signer, on another device, or before a reload.
          await ensureLatestPrivateNotesDelivered<LatestPrivateNote>({
            latestPrivateNotes: () => retryIfSessionDied(() => latestCanonicalPrivateNotes(ms)).catch((err: unknown) => {
              throw new Error(`Could not read the last transaction from Guardian: ${formatError(err)}`);
            }),
            committedAt: (n) => checks.committedAt(n.note).catch((err: unknown) => {
              throw new Error(`Could not reach the Miden node: ${formatError(err)}`);
            }),
            isConsumed: (n, block) => checks.isConsumed(n.note, block).catch((err: unknown) => {
              throw new Error(`Could not reach the Miden node: ${formatError(err)}`);
            }),
            deliver: async (n, to) => {
              const inclusionProof = await checks.fetchProof(n.note);
              if (!inclusionProof) throw new Error("its inclusion proof is not available yet");
              await client.notes.sendPrivate({ note: n.note, to, inclusionProof });
            },
          });
          return report(null);
        } catch (err) {
          return report(new PrivateNoteBlockedError(formatError(err), err instanceof UndeliveredPrivateNoteError));
        } finally {
          checks.free();
        }
      });
      privateNoteCheck.current = { ms, run };
      void run.finally(() => {
        if (privateNoteCheck.current?.run === run) privateNoteCheck.current = null;
      });
      return run;
    },
    [deliverPendingNotes],
  );
  // Before every operation, not only on load: another signer may have
  // executed a private send from another device meanwhile. An account Guardian
  // does not know yet has no history to check: say what is missing instead.
  ensurePrivateNotesClearRef.current = async (ms: Multisig) => {
    if (guardianRegistrationRequired && multisigRef.current === ms) {
      throw new UserFacingError("This account is not registered on Guardian yet. Use Retry Guardian registration first.");
    }
    const blocked = await checkPrivateNotes(ms);
    if (blocked !== null) throw blocked;
  };

  // On load, and again once a pending Guardian registration completes: an
  // account Guardian does not know yet has no history to check (it answers 404).
  // Not while the account is still loading: its own Guardian requests come
  // first (on Ledger, each one is a device approval).
  const accountOnGuardian = !guardianRegistrationRequired && !registeringOnGuardian && !loadingAccount;
  useEffect(() => {
    const ms = multisigRef.current;
    if (loadedAccountId && clientStartup.phase === "ready" && accountOnGuardian && ms?.accountId === loadedAccountId) {
      void checkPrivateNotes(ms, 15_000);
    }
  }, [loadedAccountId, clientStartup.phase, accountOnGuardian, checkPrivateNotes]);

  const retryPrivateDeliveries = useCallback(async () => {
    if (multisigRef.current) await checkPrivateNotes(multisigRef.current, 60_000);
  }, [checkPrivateNotes]);

  /**
   * Asks Guardian to abandon the candidate at `nonce` and reports the outcome.
   * Guardian re-checks the chain first and refuses if the transaction landed.
   */
  const releaseLock = useCallback(
    async (ms: Multisig, candidate: { proposalId: string; nonce: number }) => {
      const stillCurrent = () => multisigRef.current === ms;
      // Still released on Guardian, but the screen belongs to the account now
      // shown: its finally would never reset these.
      if (stillCurrent()) {
        setReleasingCandidate(true);
        setPendingCandidateWarning(
          "Unlocking the account. Guardian first confirms the transaction did not land, which can take up to a minute.",
        );
      }
      try {
        let outcome;
        try {
          outcome = await releasePendingCandidate(ms, candidate.nonce, { cancelled: () => !stillCurrent() });
        } catch (err) {
          if (!stillCurrent()) return;
          setPendingCandidateWarning(null);
          setError(`${describeExecutionError(err, "Could not unlock the account")} It is safe to try again.`);
          return;
        }
        diagnosticLog("lock.RELEASE_OUTCOME", { accountId: ms.accountId, ...candidate, outcome });
        if (!stillCurrent()) return;

        switch (outcome) {
          case "abandoned": {
            // Guardian confirmed the transaction did not land and discarded it.
            setLockedCandidate(null);
            // So its private note will never exist: drop the pending delivery,
            // which would otherwise lock the account (privateNoteGuard) until
            // the record expires, and re-check the account.
            removePendingDelivery(candidate.proposalId);
            setUndeliveredNotes((all) => all.filter((n) => n.proposalId !== candidate.proposalId));
            let proposalSurvived: boolean;
            try {
              const synced = await ms.syncProposals();
              if (!stillCurrent()) return;
              setProposals(synced);
              proposalSurvived = synced.some((p) => p.id === candidate.proposalId && isProposalActionable(p));
            } catch {
              if (!stillCurrent()) return;
              setPendingCandidateWarning(
                "The account is unlocked, but proposals could not be refreshed. Sync before executing or re-creating anything.",
              );
              return;
            } finally {
              // After the refresh, not alongside it: on Ledger each is a device approval.
              if (stillCurrent()) void checkPrivateNotes(ms, 15_000, { fresh: true });
            }
            toast.success("The account is unlocked.");
            setPendingCandidateWarning(
              proposalSurvived
                ? "The account is unlocked. Nothing from the stuck execution reached the chain; you can execute the proposal again."
                : "The account is unlocked and Guardian discarded the stuck proposal. Nothing from it reached the chain, so create it again to continue.",
            );
            return;
          }
          case "retained":
            // Unlocked, but Guardian could not rule out that it landed; it may
            // still be promoted. Never present this as "did not happen".
            setLockedCandidate(null);
            await handleSync().catch(() => {});
            if (!stillCurrent()) return;
            void checkPrivateNotes(ms, 60_000, { fresh: true });
            setPendingCandidateWarning(
              "Guardian unlocked the account but could not confirm whether the earlier transaction landed. " +
                "Do not re-create it yet: sync again in a few minutes and check balances and history first.",
            );
            return;
          case "landed":
            setLockedCandidate(null);
            setPendingCandidateWarning("The earlier transaction did land on-chain, so nothing was unlocked. Syncing…");
            await handleSync().catch(() => {});
            // Its private note (if any) is delivered from Guardian's record of it.
            if (stillCurrent()) void checkPrivateNotes(ms, 60_000, { fresh: true });
            return;
          case "timeout":
            setPendingCandidateWarning("Guardian has not finished unlocking yet. It is safe to try again in a moment.");
            return;
          default:
            setLockedCandidate(null);
            await handleSync().catch(() => {});
            if (!stillCurrent()) return;
            setPendingCandidateWarning(
              "Guardian no longer holds this execution as pending; it was resolved another way. Check the synced state before retrying.",
            );
        }
      } finally {
        if (stillCurrent()) setReleasingCandidate(false);
      }
    },
    [handleSync, checkPrivateNotes],
  );

  const handleExecuteProposal = useCallback(
    async (proposalId: string) => {
      if (!multisig || accountOpInFlight.current === multisig.accountId) return;
      const ms = multisig;
      accountOpInFlight.current = ms.accountId;

      setExecutingProposal(proposalId);
      setError(null);
      setPendingCandidateWarning(null);
      setLockedCandidate(null);
      clearExecutionPushed(ms.accountId);
      let executing: { id: string; nonce: number } | undefined;
      try {
        await ensurePrivateNotesClearRef.current(ms);
        // This tab's copy of the account must match Guardian's: 0.18.1 refuses
        // to execute a proposal made for another state than the one held here.
        await retryIfSessionDied(() => multisig.syncState());
        // Align local proposal cache with Guardian before executing. After any
        // previous execute, Guardian's proposal state can diverge from the local
        // cache — re-syncing here ensures getDeltaProposal inside executeProposal
        // finds a current, signed proposal instead of returning 404.
        const synced = await multisig.syncProposals();
        setProposals(synced);
        const fresh = synced.find((p) => p.id === proposalId);
        if (!fresh) {
          throw new Error(
            "Proposal no longer exists on Guardian. This usually means the account state " +
              "has advanced since this proposal was created. Try creating a new proposal.",
          );
        }
        if (!isProposalActionable(fresh)) {
          throw new Error(
            fresh.verification.status === "failed"
              ? `Proposal verification failed: ${fresh.verification.message}`
              : `Proposal is not ready to execute (status: ${fresh.status}).`,
          );
        }
        const unreachable = switchGuardianProblem(fresh);
        if (unreachable) throw new UserFacingError(unreachable);
        executing = { id: fresh.id, nonce: fresh.nonce };

        // A private note is delivered after the transaction commits (the note
        // transport needs its inclusion proof). Keep it in memory so it can be
        // relayed as soon as it lands; after a failure or a reload, Guardian's
        // copy is used instead (privateNoteGuard.ts). Refuse a private send
        // whose summary holds no note: nobody could reconstruct it.
        let privateDelivery = false;
        if (fresh.metadata.proposalType === "p2id" && fresh.metadata.noteType === "private") {
          const notes = getOutputNotesFromTxSummary(fresh.txSummary);
          if (notes.length === 0) {
            throw new Error("This private send has no private note to deliver, so it cannot be executed safely.");
          }
          recordPendingDelivery({
            accountId: ms.accountId,
            proposalId: fresh.id,
            recipientId: fresh.metadata.recipientId,
            notes: notes.map(encodeNote),
            createdAt: Date.now(),
          });
          executingSends.current.add(fresh.id);
          privateDelivery = true;
        }

        // Built-ins execute via Guardian's own signed-proposal pipeline. A CUSTOM admin
        // proposal (e.g. a USDCx admin action) instead needs its deterministic request
        // rebuilt from its recipe and the resulting execution advice folded in — see
        // `executeCustomProposal`.
        if (fresh.metadata.proposalType === "custom") {
          if (!midenClient) throw new Error("The Miden client is not ready to execute this proposal.");
          await executeCustomProposal(ms, midenClient, fresh);
        } else {
          await multisig.executeProposal(proposalId);
        }
        executingSends.current.delete(proposalId);
        // Durable record: Guardian prunes this from `proposals` once it is no
        // longer pending (and never canonicalizes custom proposals at all), so
        // without this the execution would vanish from the Transaction tab.
        setProposalHistory(historyEntries(recordExecuted(ms.accountId, proposalId)));
        toast.success("Proposal executed successfully");
        // The user may have switched or reloaded the account meanwhile: never
        // show this account's results on another one. A reloaded account
        // still gets its new note delivered.
        if (multisigRef.current !== ms) {
          const reloaded = multisigRef.current;
          if (reloaded?.accountId === ms.accountId) void checkPrivateNotes(reloaded, privateDelivery ? 180_000 : 15_000, { fresh: true });
          return;
        }
        setProposals(multisig.listProposals());
        refreshOnChainHistory();

        // Sync after execution
        if (midenClient) {
          setSyncingState(true);
          try {
            try {
              await midenClient.sync();
            } catch {
              await new Promise((resolve) => setTimeout(resolve, 500));
              await midenClient.sync();
            }
            await refreshAccount(multisig);
          } catch (syncErr) {
            const message =
              syncErr instanceof Error ? syncErr.message : String(syncErr);
            if (multisigRef.current === ms) await handleLocalStateAhead(multisig, message);
          } finally {
            setSyncingState(false);
          }
        }
        // Deliver the new private note (if any) and re-check the account,
        // after the refresh rather than alongside it: on Ledger each Guardian
        // request is a device prompt, and they would queue up together.
        void checkPrivateNotes(ms, privateDelivery ? 180_000 : 15_000, { fresh: true });
      } catch (err) {
        const message = operationErrorMessage(err, (e) => describeExecutionError(e, "Execute failed"));
        // Drop the in-memory note whatever the failure. If the transaction
        // landed after all (an unclear submit), Guardian records it as
        // canonical and the private-note guard delivers it from there.
        const droppedNote = Boolean(executing)
          && pendingDeliveries(ms.accountId).some((p) => p.proposalId === executing?.id);
        if (executing) {
          removePendingDelivery(executing.id);
          setUndeliveredNotes((all) => all.filter((n) => n.proposalId !== executing?.id));
        }
        if (isPendingCandidateError(err)) {
          // Another execution already holds the account's Guardian lock.
          await inspectAccountLock(ms);
        } else {
          if (multisigRef.current === ms) setError(message);
          toast.error(message);
          // Guardian accepted this execute's push before it failed, so the lock is
          // ours and can never land: release it right away instead of leaving the
          // account locked until Guardian gives up on it.
          if (executing && executionWasPushed(ms.accountId)) {
            setExecutingProposal(null);
            await releaseLock(ms, { proposalId: executing.id, nonce: executing.nonce });
          }
        }
        // An operation tried while this send was proving was refused on its
        // note, and left the account shown as locked. That note is gone now:
        // check again so the lock lifts. Only then, since on Ledger each check
        // is a device approval.
        if (droppedNote && multisigRef.current === ms
          && (privateNoteGuardRef.current.phase === "blocked" || privateNoteGuardRef.current.phase === "unverified")) {
          void checkPrivateNotes(ms, 15_000, { fresh: true });
        }
        throw err;
      } finally {
        executingSends.current.delete(proposalId);
        clearExecutionPushed(ms.accountId);
        // Cleared even if the account changed meanwhile, or it stays "Executing…".
        setExecutingProposal((current) => (current === proposalId ? null : current));
        if (accountOpInFlight.current === ms.accountId) accountOpInFlight.current = null;
      }
    },
    [multisig, midenClient, inspectAccountLock, releaseLock, refreshAccount, handleLocalStateAhead, checkPrivateNotes, refreshOnChainHistory],
  );

  /** Lets any signer release a lock that has outlived every live execution. */
  const unlockAccount = useCallback(async () => {
    const ms = multisig;
    const lock = lockedCandidate;
    if (!ms || !lock || accountOpInFlight.current === ms.accountId) return;
    if (lock.accountId.toLowerCase() !== ms.accountId.toLowerCase()) return;
    if (msUntilUnlockable(lock) > 0) return;
    accountOpInFlight.current = ms.accountId;
    setError(null);
    try {
      await releaseLock(ms, lock);
    } finally {
      if (accountOpInFlight.current === ms.accountId) accountOpInFlight.current = null;
    }
  }, [multisig, lockedCandidate, releaseLock]);

  const handleExportProposal = useCallback(
    (proposalId: string) => {
      if (!multisig) return;

      try {
        const json = multisig.exportProposalToJson(proposalId);
        navigator.clipboard.writeText(json);
        toast.success("Proposal JSON copied to clipboard");
      } catch (err) {
        setError(
          `Failed to export: ${err instanceof Error ? err.message : "Unknown"}`,
        );
      }
    },
    [multisig],
  );

  const handleSignProposalOffline = useCallback(
    async (proposalId: string) => {
      if (!multisig) return;

      try {
        const proposal = multisig.listProposals().find((p) => p.id === proposalId);
        const unreachable = proposal && switchGuardianProblem(proposal);
        if (unreachable) throw new UserFacingError(unreachable);
        await ensurePrivateNotesClearRef.current(multisig);
        const json = await multisig.signProposalOffline(proposalId);
        navigator.clipboard.writeText(json);
        setProposals(multisig.listProposals());
        toast.success("Signed! Updated proposal JSON copied to clipboard");
      } catch (err) {
        setError(operationErrorMessage(err, (e) => `Failed to sign offline: ${e instanceof Error ? e.message : "Unknown"}`));
      }
    },
    [multisig],
  );

  const handleImportProposal = useCallback(
    async (json: string) => {
      if (!multisig || !json.trim()) return;

      try {
        await ensurePrivateNotesClearRef.current(multisig);
        const proposal = await multisig.importProposal(json.trim());
        setProposals(multisig.listProposals());
        toast.success(`Proposal imported: ${proposal.id.slice(0, 12)}...`);
      } catch (err) {
        setError(operationErrorMessage(err, (e) => `Failed to import: ${e instanceof Error ? e.message : "Unknown"}`));
      }
    },
    [multisig],
  );

  const handleDisconnect = useCallback(() => {
    if (walletSource === "ledger") disconnectLedger();
    setMultisig(null);
    setGuardianRegistrationRequired(false);
    setGuardianState(null);
    setProposals([]);
    setError(null);
    setDetectedConfig(null);
    setConsumableNotes([]);
  }, [walletSource, disconnectLedger]);

  const connectMidenWallet = useCallback(async () => {
    try {
      await connectMidenWalletRaw();
    } catch (err) {
      toast.error(classifyWalletError(err));
    }
  }, [connectMidenWalletRaw]);

  const disconnectMidenWallet = useCallback(async () => {
    await disconnectMidenWalletRaw();
    // Recreate the adapter so the next connect() gets a clean instance —
    // the extension may leave window.midenWallet in a stale state after disconnect.
    setMidenWalletAdapter(
      new MidenWalletAdapter({ appName: "Miden Multisig" }),
    );
  }, [disconnectMidenWalletRaw]);

  const proposalStats = useMemo<HistoryStats>(() => statsFromEntries(proposalHistory), [proposalHistory]);

  const value = useMemo(
    (): MultisigContextValue => ({
      ledger,
      midenClient,
      multisigClient,
      signer,
      multisig,
      error,
      pendingCandidateWarning,
      lockedCandidate,
      releasingCandidate,
      accountFunding,

      guardianUrl,
      guardianStatus,
      guardianCommitment,
      guardianPublicKey,
      guardianState,

      detectedConfig,
      proposals,
      consumableNotes,

      walletSource,
      activeCommitment,
      activeScheme,
      paraSession: {
        connected: paraSession.connected,
        commitment: paraSession.commitment,
        publicKey: paraSession.publicKey,
      },
      midenWalletSession: {
        connected: midenWalletSession.connected,
        commitment: midenWalletSession.commitment,
        // The connected account's address: what identifies the Bread account for role detection
        // and direct admin actions. Dropping it here left the admin page blind to Bread's roles.
        address: midenWalletSession.address ?? null,
      },

      creating,
      registeringOnGuardian,
      guardianRegistrationRequired,
      loadingAccount,
      syncingState,
      creatingProposal,
      signingProposal,
      executingProposal,
      generatingSigner,

      handleCreate,
      handleLoad,
      handleSync,
      retryGuardianRegistration,
      retryAccountFunding,
      registerWithInvitationCode,
      guardianSession,
      accountNonce,
      startGuardianSession,
      endGuardianSession,
      sessionGrantPrompt,
      answerSessionGrant,
      retryProposalVerification,
      handleSignProposal,
      handleExecuteProposal,
      handleCancelProposal,
      cancelingProposal,
      dismissedProposalIds,
      proposalHistory,
      proposalStats,
      unlockAccount,
      handleCreateP2idProposal,
      handleCreateAdminProposal,
      handleDirectAdminAction,
      onChainHistory,
      handleSendPrivateNote,
      privateSendProgress,
      resetPrivateSendProgress,
      handleCreateConsumeNotesProposal,
      handleCreateAddSignerProposal,
      handleCreateRemoveSignerProposal,
      handleCreateChangeThresholdProposal,
      handleCreateProcedureThresholdProposal,
      handleCreateSwitchGuardianProposal,
      handleExportProposal,
      handleSignProposalOffline,
      handleImportProposal,
      handleDisconnect,
      setWalletSource,
      clientStartup,
      retryClientStartup: startClient,
      undeliveredNotes,
      retryPrivateDeliveries,
      privateNoteGuard,
      accountOperationBusy,
      setGuardianUrl,
      connectToGuardian,
      dismissWarning: () => setPendingCandidateWarning(null),
      setError,

      connectMidenWallet,
      disconnectMidenWallet,
      openParaModal: () => setParaModalOpen(true),
      paraModalOpen,
      closeParaModal: () => setParaModalOpen(false),

    }),
    [
      undeliveredNotes,
      retryPrivateDeliveries,
      privateNoteGuard,
      clientStartup,
      startClient,
      accountOperationBusy,
      ledger,
      setWalletSource,
      midenClient,
      multisigClient,
      signer,
      multisig,
      error,
      pendingCandidateWarning,
      lockedCandidate,
      releasingCandidate,
      accountFunding,
      guardianUrl,
      guardianStatus,
      guardianCommitment,
      guardianPublicKey,
      guardianState,
      detectedConfig,
      proposals,
      consumableNotes,
      walletSource,
      activeCommitment,
      activeScheme,
      paraSession.connected,
      paraSession.commitment,
      paraSession.publicKey,
      midenWalletSession.connected,
      midenWalletSession.commitment,
      midenWalletSession.address,
      creating,
      registeringOnGuardian,
      guardianRegistrationRequired,
      loadingAccount,
      syncingState,
      creatingProposal,
      signingProposal,
      executingProposal,
      generatingSigner,
      handleCreate,
      handleLoad,
      handleSync,
      retryGuardianRegistration,
      retryAccountFunding,
      registerWithInvitationCode,
      guardianSession,
      accountNonce,
      startGuardianSession,
      endGuardianSession,
      sessionGrantPrompt,
      answerSessionGrant,
      retryProposalVerification,
      handleSignProposal,
      handleExecuteProposal,
      handleCancelProposal,
      cancelingProposal,
      dismissedProposalIds,
      proposalHistory,
      proposalStats,
      unlockAccount,
      handleCreateP2idProposal,
      handleCreateAdminProposal,
      handleDirectAdminAction,
      onChainHistory,
      handleSendPrivateNote,
      privateSendProgress,
      resetPrivateSendProgress,
      handleCreateConsumeNotesProposal,
      handleCreateAddSignerProposal,
      handleCreateRemoveSignerProposal,
      handleCreateChangeThresholdProposal,
      handleCreateProcedureThresholdProposal,
      handleCreateSwitchGuardianProposal,
      handleExportProposal,
      handleSignProposalOffline,
      handleImportProposal,
      handleDisconnect,
      connectToGuardian,
      connectMidenWallet,
      disconnectMidenWallet,
      paraModalOpen,
    ],
  );

  return (
    <MultisigContext.Provider value={value}>
      {children}
    </MultisigContext.Provider>
  );
}
