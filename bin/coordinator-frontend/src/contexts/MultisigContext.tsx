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
  type ParaSigningContext,
  AccountInspector,
  isProposalActionable,
} from "@openzeppelin/miden-multisig-client";
import { GuardianHttpError } from "@openzeppelin/guardian-client";
import { Note, NoteType, type MidenClient } from "@miden-sdk/miden-sdk";

import { normalizeCommitment } from "@/lib/helpers";
import { formatError, classifyWalletError, describeExecutionError } from "@/lib/errors";
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
  fetchNoteInclusionProof,
  getOutputNotesFromTxSummary,
  registerAccountOnNode,
} from "@/lib/multisigApi";
import type { ExternalSignerParams } from "@/lib/multisigApi";
import { GUARDIAN_ENDPOINT, LOCAL_KEYS_ENABLED, MIDEN_DB_NAME, MIDEN_NETWORK } from "@/config/psm";
import { deleteDatabase, startWithStoreReset, waitForClientParts, type StartupState } from "@/lib/clientStartup";
import type { SignerInfo } from "@/types/psm";
import type { WalletSource } from "@/wallets/types";
import { getProposalActionState } from "@/lib/proposalActions";
import { useParaSession } from "@/hooks/useParaSession";
import { useLedgerSession, type LedgerSession } from "@/hooks/useLedgerSession";
import { guardianUrlProblem } from "@/lib/guardianUrl";
import { runRegistrationRetry } from "@/lib/registrationRetry";
import {
  decodeNote,
  deliverCommittedNotes,
  encodeNote,
  pendingDeliveries,
  recordPendingDelivery,
  removePendingDelivery,
} from "@/lib/privateDelivery";
import { setWalletCookie } from "@/lib/walletCookie";
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

export interface AccountFundingState {
  phase: AccountFundingPhase;
  message?: string;
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
  midenWalletSession: { connected: boolean; commitment: string | null };

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
  ) => Promise<void>;
  handleLoad: (
    accountId: string,
    signatureScheme?: SignatureScheme,
  ) => Promise<void>;
  handleSync: () => Promise<void>;
  retryGuardianRegistration: () => Promise<void>;
  retryAccountFunding: () => Promise<void>;
  retryProposalVerification: (proposalId: string) => Promise<void>;
  handleSignProposal: (proposalId: string) => Promise<void>;
  handleExecuteProposal: (proposalId: string) => Promise<void>;
  unlockAccount: () => Promise<void>;
  handleCreateP2idProposal: (
    recipientId: string,
    faucetId: string,
    amount: bigint,
  ) => Promise<void>;
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
  multisigRef.current = multisig;
  const fundingAccountId = useRef<string | null>(null);
  const [accountFunding, setAccountFunding] = useState<AccountFundingState>({
    phase: "idle",
  });

  const [guardianUrl, setGuardianUrl] = useState(GUARDIAN_ENDPOINT);
  const [guardianStatus, setGuardianStatus] = useState<
    "connected" | "connecting" | "error"
  >("connecting");
  const [guardianCommitment, setGuardianCommitment] = useState("");
  const [clientStartup, setClientStartup] = useState<StartupState>({ phase: "starting" });
  const [undeliveredNotes, setUndeliveredNotes] = useState<UndeliveredNote[]>([]);
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
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [signingProposal, setSigningProposal] = useState<string | null>(null);
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
  const clientStartupRef = useRef(clientStartup);
  clientStartupRef.current = clientStartup;
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

  // Attempt to auto-connect external wallets on mount
  useEffect(() => {
    const savedSource = localStorage.getItem("currentWalletSource");
    if (savedSource === "miden-wallet") {
      connectMidenWalletRaw().catch(() => {
        // Silently ignore auto-connect failures
      });
    }
  }, [connectMidenWalletRaw]);

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
      if (!midenWalletSession.connected) throw new Error("Connect the Miden Wallet first");
      if (!midenWalletSession.commitment || !midenWalletSession.scheme) {
        throw new Error("The Miden Wallet did not share its signing key. Reconnect it and try again");
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
      const blocked = guardianUrlProblem(url, {
        configured: GUARDIAN_ENDPOINT,
        extra: process.env.NEXT_PUBLIC_CSP_CONNECT_SRC ?? "",
        self: window.location.origin,
      });
      if (blocked) return fail(blocked, !multisigClient);
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
    [midenClient, multisig, multisigClient, guardianUrl, signer, guardianState, buildExternalParams, walletSource, activeScheme, refreshAccount],
  );

  // Initialization. Starting the in-browser Miden client downloads and compiles
  // the SDK (tens of MB of WASM), so it can take a while on a first visit;
  // Create/Load wait for it (waitForClient) instead of failing.
  const connectToGuardianRef = useRef(connectToGuardian);
  connectToGuardianRef.current = connectToGuardian;
  const startClient = useCallback(async () => {
    setClientStartup({ phase: "starting" });
    try {
      // A local store left by an older SDK (e.g. a previous deployment on this
      // domain) can stop the client from starting: reset it once and retry.
      const client = await startWithStoreReset(
        () => createMidenClient(),
        () => deleteDatabase(MIDEN_DB_NAME),
        (err) => console.warn("Miden client failed to start; resetting its local data and retrying.", err),
      );
      setMidenClient(client);

      const connected = await connectToGuardianRef.current(guardianUrl, client);
      if (!connected.ok) {
        setClientStartup({ phase: "error", error: connected.error });
        return;
      }

      if (LOCAL_KEYS_ENABLED) {
        setGeneratingSigner(true);
        let signerInfo = await loadSignerKeys();
        if (!signerInfo) {
          signerInfo = initSigner();
          await saveSignerKeys(signerInfo);
        }
        setSigner(signerInfo);
      }
      // Ready only once everything a Create/Load needs is in place.
      setClientStartup({ phase: "ready" });
    } catch (err) {
      const message = formatError(err, "Initialization failed");
      setClientStartup({ phase: "error", error: message });
      setError(message);
    } finally {
      setGeneratingSigner(false);
    }
  }, [guardianUrl]);

  useEffect(() => {
    void startClient();
    // Start once on mount; retryClientStartup starts it again on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestAccountFunding = useCallback(
    async (targetMultisig?: Multisig): Promise<void> => {
      const account = targetMultisig ?? multisig;
      // The latest client: this may run from a click made during start-up.
      const liveClient = clientPartsRef.current?.midenClient ?? midenClient;
      if (!account || !liveClient) {
        throw new Error("The Miden client and multisig account must be ready before funding.");
      }

      fundingAccountId.current = account.accountId;
      // Checked after every await: the user may have switched account meanwhile.
      const stillCurrent = () =>
        fundingAccountId.current === account.accountId &&
        multisigRef.current?.accountId === account.accountId;
      setAccountFunding({ phase: "registering" });
      try {
        await registerAccountOnNode(liveClient, account.accountId);
        if (!stillCurrent()) return;
        // Only devnet sends a funding note on registration; elsewhere the account
        // is funded like any other (e.g. from the network's faucet).
        if (MIDEN_NETWORK !== "devnet") {
          setAccountFunding({ phase: "idle" });
          return;
        }

        setAccountFunding({ phase: "waiting-for-note" });
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await liveClient.sync();
          const notes = await account.getConsumableNotes();
          if (!stillCurrent()) return;
          setConsumableNotes(notes);
          const feeFaucet = await liveClient.feeFaucetId();
          const feeFaucetHex = feeFaucet.toString().toLowerCase();
          feeFaucet.free();
          if (notes.some(note => note.assets.some(asset =>
            asset.faucetId.toLowerCase() === feeFaucetHex && asset.amount > 0n))) {
            setAccountFunding({ phase: "funding-available" });
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }

        throw new Error(
          "Registration completed, but the funding note has not appeared yet. Sync and retry funding shortly.",
        );
      } catch (fundingError) {
        if (!stillCurrent()) return;
        const message = formatError(fundingError, "Account funding failed");
        setAccountFunding({ phase: "error", message });
        throw fundingError;
      }
    },
    [midenClient, multisig],
  );

  const retryAccountFunding = useCallback(async () => {
    try {
      await requestAccountFunding();
      toast.success("Funding note is ready to receive");
    } catch (fundingError) {
      toast.error(formatError(fundingError, "Account funding failed"));
    }
  }, [requestAccountFunding]);

  const handleCreate = useCallback(
    async (
      otherSignerCommitments: string[],
      threshold: number,
      procedureThresholds?: ProcedureThreshold[],
      signatureScheme: SignatureScheme = walletSource === "ledger" ? "ecdsa" : "falcon",
    ) => {
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
          if (midenClient && ms.accountId) {
            await watchAccountNotes(midenClient, ms.accountId);
            try {
              await requestAccountFunding(ms);
            } catch {
              // Keep the newly-created account available so funding can be retried.
            }
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
        if (walletSource !== "local") {
          setError(classifyWalletError(err));
        } else {
          setError(formatError(err, "Failed to create"));
        }
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
    ],
  );

  // Auto-load saved account after initialization completes
  const autoLoadAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoLoadAttemptedRef.current) return;
    if (!multisigClient || !guardianCommitment) return;

    const savedId = localStorage.getItem("currentWalletId");
    if (!savedId) return;

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
      try {
        await midenClient.sync();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await midenClient.sync();
      }
      await fetchPrivateNotes(midenClient);

      const state = await multisig.syncState().catch((err: unknown) => {
        if (err instanceof GuardianHttpError && err.code === "account_not_found") {
          setGuardianRegistrationRequired(true);
        }
        throw err;
      });
      setGuardianRegistrationRequired(false);
      await refreshAccount(multisig, state);
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
        requestFunding: () => requestAccountFunding(multisig),
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
        const created = await create(ms);
        if (multisigRef.current === ms) setProposals(ms.listProposals());
        toast.success(`${label} proposal created`);
        return created;
      } catch (err) {
        if (multisigRef.current === ms) {
          if (isPendingCandidateError(err)) {
            await inspectAccountLock(ms);
          } else {
            setError(describeExecutionError(err, `Failed to create the ${label.toLowerCase()} proposal`));
          }
        }
        throw err;
      } finally {
        setCreatingProposal(false);
      }
    },
    [multisig, inspectAccountLock],
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

  // Creates the private send proposal only. The note is relayed to the
  // recipient right before execution (see handleExecuteProposal), by whichever
  // signer executes, so a proposal that is never executed relays nothing and
  // an execution never starts without its note delivered.
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
      await runProposalCreation("Switch Guardian", (ms) => ms.createSwitchGuardianProposal(newEndpoint, newPubkey));
    },
    [runProposalCreation],
  );

  const handleSignProposal = useCallback(
    async (proposalId: string) => {
      if (!multisig) return;

      setSigningProposal(proposalId);
      setError(null);
      try {
        const synced = await multisig.syncProposals();
        setProposals(synced);
        const fresh = synced.find((proposal) => proposal.id === proposalId);
        if (!fresh) throw new Error("Proposal no longer exists on Guardian.");
        const action = getProposalActionState(fresh, detectedConfig, activeCommitment);
        if (action.action !== "sign") {
          throw new Error(action.statusLabel);
        }
        await multisig.signProposal(proposalId);
        setProposals(multisig.listProposals());
      } catch (err) {
        const message =
          walletSource !== "local"
            ? classifyWalletError(err)
            : `Failed to sign: ${err instanceof Error ? err.message : "Unknown"}`;
        setError(message);
        throw err;
      } finally {
        setSigningProposal(null);
      }
    },
    [activeCommitment, detectedConfig, multisig, walletSource],
  );

  const loadedAccountId = multisig?.accountId ?? null;

  // Switching account starts a fresh session: nothing from the previous
  // account's lock, warnings or funding carries over.
  useEffect(() => {
    setLockedCandidate(null);
    setPendingCandidateWarning(null);
    setReleasingCandidate(false);
    setUndeliveredNotes([]);
    if (fundingAccountId.current && fundingAccountId.current !== loadedAccountId) {
      fundingAccountId.current = null;
      setAccountFunding({ phase: "idle" });
    }
  }, [loadedAccountId]);

  // Deliver this account's pending private notes (see privateDelivery.ts):
  // right after execute with a long wait for the commit, and on load or retry
  // with a short one. A note stays pending until the transport accepts it.
  const deliveringNotes = useRef(new Set<string>());
  const deliverPendingNotes = useCallback(async (accountId: string, timeoutMs: number) => {
    const client = clientPartsRef.current?.midenClient;
    if (!client) return;
    for (const pending of pendingDeliveries(accountId)) {
      if (deliveringNotes.current.has(pending.proposalId)) continue;
      deliveringNotes.current.add(pending.proposalId);
      try {
        const notes = pending.notes.map((encoded) => decodeNote(encoded, (bytes) => Note.deserialize(bytes)));
        await deliverCommittedNotes(client, notes, pending.recipientId, { fetchProof: fetchNoteInclusionProof, timeoutMs });
        removePendingDelivery(pending.proposalId);
        setUndeliveredNotes((all) => all.filter((n) => n.proposalId !== pending.proposalId));
        toast.success("Private note delivered to the recipient");
      } catch (err) {
        if (multisigRef.current?.accountId !== accountId) return;
        const error = formatError(err);
        setUndeliveredNotes((all) => [
          ...all.filter((n) => n.proposalId !== pending.proposalId),
          { proposalId: pending.proposalId, recipientId: pending.recipientId, error },
        ]);
      } finally {
        deliveringNotes.current.delete(pending.proposalId);
      }
    }
  }, []);

  useEffect(() => {
    if (loadedAccountId && clientStartup.phase === "ready") void deliverPendingNotes(loadedAccountId, 15_000);
  }, [loadedAccountId, clientStartup.phase, deliverPendingNotes]);

  const retryPrivateDeliveries = useCallback(async () => {
    if (multisigRef.current) await deliverPendingNotes(multisigRef.current.accountId, 60_000);
  }, [deliverPendingNotes]);

  /**
   * Asks Guardian to abandon the candidate at `nonce` and reports the outcome.
   * Guardian re-checks the chain first and refuses if the transaction landed.
   */
  const releaseLock = useCallback(
    async (ms: Multisig, candidate: { proposalId: string; nonce: number }) => {
      const stillCurrent = () => multisigRef.current === ms;
      setReleasingCandidate(true);
      setPendingCandidateWarning(
        "Unlocking the account. Guardian first confirms the transaction did not land, which can take up to a minute.",
      );
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
            setPendingCandidateWarning(
              "Guardian unlocked the account but could not confirm whether the earlier transaction landed. " +
                "Do not re-create it yet: sync again in a few minutes and check balances and history first.",
            );
            return;
          case "landed":
            setLockedCandidate(null);
            setPendingCandidateWarning("The earlier transaction did land on-chain, so nothing was unlocked. Syncing…");
            await handleSync().catch(() => {});
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
    [handleSync],
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
        executing = { id: fresh.id, nonce: fresh.nonce };

        // A private note is delivered after the transaction commits (the note
        // transport needs its inclusion proof). Record it first, so a committed
        // note is never left undelivered, and refuse a private send whose
        // summary holds no note: nobody could reconstruct it.
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
          privateDelivery = true;
        }

        await multisig.executeProposal(proposalId);
        setProposals(multisig.listProposals());
        toast.success("Proposal executed successfully");
        if (privateDelivery) void deliverPendingNotes(ms.accountId, 180_000);

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
            await handleLocalStateAhead(multisig, message);
          } finally {
            setSyncingState(false);
          }
        }
      } catch (err) {
        const message = describeExecutionError(err, "Execute failed");
        // Never reached Guardian, so it cannot land: nothing to deliver.
        if (executing && !executionWasPushed(ms.accountId)) removePendingDelivery(executing.id);
        if (isPendingCandidateError(err)) {
          // Another execution already holds the account's Guardian lock.
          await inspectAccountLock(ms);
        } else {
          setError(message);
          toast.error(message);
          // Guardian accepted this execute's push before it failed, so the lock is
          // ours and can never land: release it right away instead of leaving the
          // account locked until Guardian gives up on it.
          if (executing && executionWasPushed(ms.accountId)) {
            setExecutingProposal(null);
            await releaseLock(ms, { proposalId: executing.id, nonce: executing.nonce });
          }
        }
        throw err;
      } finally {
        clearExecutionPushed(ms.accountId);
        if (multisigRef.current === ms) setExecutingProposal(null);
        if (accountOpInFlight.current === ms.accountId) accountOpInFlight.current = null;
      }
    },
    [multisig, midenClient, inspectAccountLock, releaseLock, refreshAccount, handleLocalStateAhead, deliverPendingNotes],
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
        const json = await multisig.signProposalOffline(proposalId);
        navigator.clipboard.writeText(json);
        setProposals(multisig.listProposals());
        toast.success("Signed! Updated proposal JSON copied to clipboard");
      } catch (err) {
        setError(
          `Failed to sign offline: ${err instanceof Error ? err.message : "Unknown"}`,
        );
      }
    },
    [multisig],
  );

  const handleImportProposal = useCallback(
    async (json: string) => {
      if (!multisig || !json.trim()) return;

      try {
        const proposal = await multisig.importProposal(json.trim());
        setProposals(multisig.listProposals());
        toast.success(`Proposal imported: ${proposal.id.slice(0, 12)}...`);
      } catch (err) {
        setError(
          `Failed to import: ${err instanceof Error ? err.message : "Unknown"}`,
        );
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
      retryProposalVerification,
      handleSignProposal,
      handleExecuteProposal,
      unlockAccount,
      handleCreateP2idProposal,
      handleSendPrivateNote,
      privateSendProgress,
      resetPrivateSendProgress,
      handleCreateConsumeNotesProposal,
      handleCreateAddSignerProposal,
      handleCreateRemoveSignerProposal,
      handleCreateChangeThresholdProposal,
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
      retryProposalVerification,
      handleSignProposal,
      handleExecuteProposal,
      unlockAccount,
      handleCreateP2idProposal,
      handleSendPrivateNote,
      privateSendProgress,
      resetPrivateSendProgress,
      handleCreateConsumeNotesProposal,
      handleCreateAddSignerProposal,
      handleCreateRemoveSignerProposal,
      handleCreateChangeThresholdProposal,
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
