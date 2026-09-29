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
  type DetectedMultisigConfig,
  type Proposal,
  type SignatureScheme,
  type ProcedureThreshold,
  type ParaSigningContext,
  AccountInspector,
  isProposalActionable,
} from "@openzeppelin/miden-multisig-client";
import { GuardianHttpError } from "@openzeppelin/guardian-client";
import { AccountId, NoteType, type MidenClient } from "@miden-sdk/miden-sdk";

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
  getOutputNotesFromTxSummary,
  relayPrivateNote,
  registerAccountOnNode,
} from "@/lib/multisigApi";
import type { ExternalSignerParams } from "@/lib/multisigApi";
import { GUARDIAN_ENDPOINT } from "@/config/psm";
import type { SignerInfo } from "@/types/psm";
import type { WalletSource } from "@/wallets/types";
import { getProposalActionState } from "@/lib/proposalActions";
import { useParaSession } from "@/hooks/useParaSession";
import { useLedgerSession, type LedgerSession } from "@/hooks/useLedgerSession";
import { useMidenWallet } from "@/hooks/useMidenWallet";
import { MidenWalletAdapter } from "@miden-sdk/miden-wallet-adapter-miden";
import { diagnosticError, diagnosticLog, logReceiveFunding } from '@/lib/midenDiagnostics';
import {
  claimable,
  clearStuckCandidate,
  isPendingCandidateError,
  loadStuckCandidate,
  probeCandidate,
  releasePendingCandidate,
  saveStuckCandidate,
  type StuckCandidate,
} from "@/lib/pendingCandidate";

// Temporary debug instrumentation for the receive-funds vault investigation.
// Logs fully-expanded JSON (via a BigInt-safe replacer) instead of console's
// collapsed "Array(1)" previews, which hid the actual data in prior sessions.
// Development builds only: the payloads include vault balances and note IDs,
// private notes among them.
const DEBUG_LOGS = process.env.NODE_ENV === "development";

function debugLog(tag: string, data: unknown): void {
  if (!DEBUG_LOGS) return;
  try {
    const json = JSON.stringify(
      data,
      (_key, value) => (typeof value === "bigint" ? `${value.toString()}n` : value),
      2,
    );
    console.log(`[DEBUG] ${tag}\n${json}`);
  } catch (stringifyErr) {
    console.log(`[DEBUG] ${tag} (unstringifiable):`, data, stringifyErr);
  }
}

function rawVaultSnapshot(account: {
  vault(): { fungibleAssets(): Iterable<{ faucetId(): { toString(): string }; amount(): unknown }> };
  nonce?: () => { toString(): string };
}): { nonce: string | null; fungibleAssets: Array<{ faucetId: string; amount: string }> } | { error: string } {
  try {
    const nonce = account.nonce ? account.nonce().toString() : null;
    const fungibleAssets = Array.from(account.vault().fungibleAssets()).map((a) => ({
      faucetId: a.faucetId().toString(),
      amount: String(a.amount()),
    }));
    return { nonce, fungibleAssets };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// Fetches the account directly from the underlying raw client, bypassing
// `multisig.account` (a cached field the SDK only refreshes inside syncState()
// AFTER its nonce guard passes — see ensureSafeToOverwriteLocalState in
// multisig.js). This is the same call syncState() makes internally right
// before it throws, so it should reflect the TRUE current local state even
// when `multisig.account` is stuck on a stale pre-execute snapshot.
async function getLiveAccountSnapshot(
  multisig: Multisig,
): Promise<ReturnType<typeof rawVaultSnapshot> | { error: string }> {
  // Only feeds debugLog; skip the extra store read when logging is off.
  if (!DEBUG_LOGS) return { error: "debug logging disabled" };
  try {
    const rawClient = await (
      multisig as unknown as {
        getRawClient(): Promise<{ getAccount(id: unknown): Promise<unknown> }>;
      }
    ).getRawClient();
    const accountId = AccountId.fromHex(multisig.accountId);
    const liveAccount = await rawClient.getAccount(accountId);
    if (!liveAccount) return { error: "getAccount returned null" };
    return rawVaultSnapshot(liveAccount as Parameters<typeof rawVaultSnapshot>[0]);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export type PrivateSendStep =
  | "idle"
  | "creating-proposal"
  | "relaying-notes"
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

interface MultisigContextValue {
  // Core state
  midenClient: MidenClient | null;
  multisigClient: MultisigClient | null;
  signer: SignerInfo | null;
  multisig: Multisig | null;
  error: string | null;
  pendingCandidateWarning: string | null;
  /** Set when Execute was refused because an earlier candidate is still pending on Guardian. */
  stuckCandidate: StuckCandidate | null;
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
  releaseStuckCandidateAndRetry: () => Promise<void>;
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
  setGuardianUrl: (url: string) => void;
  connectToGuardian: (url: string) => Promise<void>;
  dismissWarning: () => void;
  setError: (error: string | null) => void;

  // Wallet actions
  connectMidenWallet: () => Promise<void>;
  disconnectMidenWallet: () => Promise<void>;
  openParaModal: () => void;
  paraModalOpen: boolean;
  closeParaModal: () => void;

  // Deprecated aliases for backwards compatibility
  /** @deprecated Use guardianUrl */
  psmUrl: string;
  /** @deprecated Use guardianStatus */
  psmStatus: "connected" | "connecting" | "error";
  /** @deprecated Use connectToGuardian */
  connectToPsm: (url: string) => Promise<void>;
  /** @deprecated Use setGuardianUrl */
  setPsmUrl: (url: string) => void;
  /** @deprecated Use handleCreateP2idProposal */
  handleCreateSendProposal: (
    recipientId: string,
    faucetId: string,
    amount: bigint,
  ) => Promise<void>;
  /** @deprecated Use handleCreateSwitchGuardianProposal */
  handleCreateSwitchPsmProposal: (
    newEndpoint: string,
    newPubkey: string,
  ) => Promise<void>;
  /** @deprecated Use registeringOnGuardian */
  registeringOnPsm: boolean;
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
  const [stuckRecord, setStuckRecord] = useState<StuckCandidate | null>(null);
  const [releasingCandidate, setReleasingCandidate] = useState(false);
  // Execute and release both drive the account's single Guardian lock; never
  // let them overlap (double clicks, or Execute pressed mid-release).
  const accountOpInFlight = useRef(false);
  const [accountFunding, setAccountFunding] = useState<AccountFundingState>({
    phase: "idle",
  });

  const [guardianUrl, setGuardianUrl] = useState(GUARDIAN_ENDPOINT);
  const [guardianStatus, setGuardianStatus] = useState<
    "connected" | "connecting" | "error"
  >("connecting");
  const [guardianCommitment, setGuardianCommitment] = useState("");
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
    return (
      (localStorage.getItem("currentWalletSource") as WalletSource) ??
      "miden-wallet"
    );
  });
  const [paraModalOpen, setParaModalOpen] = useState(false);
  const ledger = useLedgerSession();
  const disconnectLedger = ledger.disconnect;
  const latestLedgerSigner = useRef(ledger.signer);
  latestLedgerSigner.current = ledger.signer;
  const setWalletSource = useCallback((source: WalletSource) => {
    if (source === walletSource) return;
    if (creating || loadingAccount || creatingProposal || signingProposal || executingProposal || releasingCandidate || syncingState || registeringOnGuardian || ["creating-proposal", "relaying-notes"].includes(privateSendProgress.step)) {
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
  }, [walletSource, disconnectLedger, creating, loadingAccount, creatingProposal,
    signingProposal, executingProposal, releasingCandidate, syncingState, registeringOnGuardian, privateSendProgress.step]);

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

  const activeCommitment = useMemo(() => {
    if (walletSource === "ledger") return ledger.signer?.commitment ?? null;
    if (walletSource === "para" && paraSession.connected)
      return paraSession.commitment;
    if (walletSource === "miden-wallet" && midenWalletSession.connected)
      return midenWalletSession.commitment;
    if (!signer) return null;
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
    if (walletSource === "para" && paraSession.connected && paraClient) {
      const walletId = getWalletId();
      if (!walletId || !paraSession.commitment || !paraSession.publicKey)
        return undefined;
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
    if (walletSource === "miden-wallet" && midenWalletSession.connected) {
      if (!midenWalletSession.commitment || !midenWalletSession.scheme) {
        return undefined;
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
    async (url: string, clientParam?: MidenClient): Promise<void> => {
      setGuardianStatus("connecting");
      setError(null);
      if (!url.trim()) {
        setGuardianStatus("error");
        setError("Set NEXT_PUBLIC_GUARDIAN_ENDPOINT to a Guardian 0.18 RC devnet endpoint.");
        return;
      }
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
          return;
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

        if (multisig && signer && guardianState?.stateDataBase64) {
          setRegisteringOnGuardian(true);
          try {
            const clientSigner = createSigner(
              signer,
              walletSource === "ledger" ? "ecdsa" : signer.activeScheme,
              buildExternalParams(),
            );
            const reloadedMs = await loadMultisigAccount(
              msClient,
              multisig.accountId,
              clientSigner,
            );
            if (walletSource === "ledger" && clientSigner !== latestLedgerSigner.current) throw new Error("Ledger session changed; load the account again.");
            setMultisig(reloadedMs);

            const state = await reloadedMs.syncState();
            const [synced, notes] = await Promise.all([
              reloadedMs.syncProposals(),
              reloadedMs.getConsumableNotes(),
            ]);
            const config = AccountInspector.fromAccount(reloadedMs.account);
            setGuardianState(state);
            setDetectedConfig(config);
            setProposals(synced);
            setConsumableNotes(notes);
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
                multisig.setGuardianClient(msClient.guardianClient);
                const state = await multisig.syncState();
                const [synced, notes] = await Promise.all([
                  multisig.syncProposals(),
                  multisig.getConsumableNotes(),
                ]);
                const config = AccountInspector.fromAccount(multisig.account);
                setGuardianState(state);
                setDetectedConfig(config);
                setProposals(synced);
                setConsumableNotes(notes);
                toast.success("Account registered on new Guardian");
              } catch (registerErr) {
                setError(
                  `Failed to register account on new Guardian: ${formatError(registerErr)}`,
                );
              }
            } else {
              setError(
                `Failed to load account from Guardian: ${formatError(loadErr)}`,
              );
            }
          } finally {
            setRegisteringOnGuardian(false);
          }
        }
      } catch (err) {
        const msg = formatError(err);
        setGuardianStatus("error");
        setGuardianCommitment("");
        setGuardianPublicKey(undefined);
        setError(`Failed to connect to Guardian: ${msg}`);
      }
    },
    [midenClient, multisig, signer, guardianState, buildExternalParams, walletSource],
  );

  // Initialization
  useEffect(() => {
    const init = async () => {
      try {
        const client = await createMidenClient();
        setMidenClient(client);

        await connectToGuardian(guardianUrl, client);

        setGeneratingSigner(true);
        let signerInfo = await loadSignerKeys();
        if (!signerInfo) {
          signerInfo = initSigner();
          await saveSignerKeys(signerInfo);
        }
        setSigner(signerInfo);
      } catch (err) {
        setError(formatError(err, "Initialization failed"));
      } finally {
        setGeneratingSigner(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestAccountFunding = useCallback(
    async (targetMultisig?: Multisig): Promise<void> => {
      const account = targetMultisig ?? multisig;
      if (!account || !midenClient) {
        throw new Error("The Miden client and multisig account must be ready before funding.");
      }

      setAccountFunding({ phase: "registering" });
      try {
        await registerAccountOnNode(midenClient, account.accountId);

        setAccountFunding({ phase: "waiting-for-note" });
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await midenClient.sync();
          const notes = await account.getConsumableNotes();
          setConsumableNotes(notes);
          const feeFaucet = await midenClient.feeFaucetId();
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
        const msg = "Set NEXT_PUBLIC_GUARDIAN_ENDPOINT to a Guardian 0.18 RC devnet endpoint.";
        setError(msg);
        throw new Error(msg);
      }
      if (!multisigClient || !signer || !guardianCommitment) {
        const msg = "Client not initialized. Try reconnecting to Guardian.";
        setError(msg);
        throw new Error(msg);
      }

      setCreating(true);
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
          signer,
          signatureScheme,
          externalParams,
        );
        const signerCommitment =
          externalParams?.ledgerSigner?.commitment ??
          externalParams?.paraContext?.commitment ??
          externalParams?.midenWalletContext?.commitment ??
          (signatureScheme === "ecdsa"
            ? signer.ecdsa.commitment
            : signer.falcon.commitment);

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
          document.cookie = `currentWalletId=${ms.accountId}; path=/; max-age=31536000`;
        }

        setRegisteringOnGuardian(true);
        let registeredOnGuardian = false;
        try {
          setGuardianRegistrationRequired(true);
          await ms.registerOnGuardian();
          registeredOnGuardian = true;
          setGuardianRegistrationRequired(false);
          if (midenClient && ms.accountId) {
            try {
              await registerAccountNoteTag(midenClient, ms.accountId);
            } catch {
              /* tag may already exist */
            }
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
            try {
              await midenClient.notes.fetchPrivate();
            } catch {
              /* no private notes or transport unavailable */
            }
          }
          const state = await ms.syncState();
          const [synced, notes] = await Promise.all([
            ms.syncProposals(),
            ms.getConsumableNotes(),
          ]);
          const config = AccountInspector.fromAccount(ms.account);
          setDetectedConfig(config);
          setGuardianState(state);
          setProposals(synced);
          setConsumableNotes(notes);
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
      multisigClient,
      signer,
      guardianUrl,
      guardianCommitment,
      guardianPublicKey,
      walletSource,
      buildExternalParams,
      midenClient,
      requestAccountFunding,
    ],
  );

  const handleLoad = useCallback(
    async (accountId: string, signatureScheme: SignatureScheme = walletSource === "ledger" ? "ecdsa" : "falcon") => {
      if (!guardianUrl.trim()) {
        const msg = "Set NEXT_PUBLIC_GUARDIAN_ENDPOINT to a Guardian 0.18 RC devnet endpoint.";
        setError(msg);
        throw new Error(msg);
      }
      if (!multisigClient || !signer) {
        setError("Client not initialized. Try reconnecting to Guardian.");
        return;
      }
      if (!guardianCommitment) {
        setGuardianStatus("error");
        setError(
          "Not connected to Guardian. Check the endpoint and try again.",
        );
        return;
      }

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
          signer,
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
          document.cookie = `currentWalletId=${ms.accountId}; path=/; max-age=31536000`;
        }

        if (pendingRegistration) {
          setError("This account is saved locally but is not registered on Guardian. Retry Guardian registration.");
          return;
        }

        if (midenClient && ms.accountId) {
          try {
            await registerAccountNoteTag(midenClient, ms.accountId);
          } catch {
            /* tag may already exist */
          }
          try {
            await midenClient.sync();
          } catch {
            /* non-fatal */
          }
          try {
            await midenClient.notes.fetchPrivate();
          } catch {
            /* no private notes or transport unavailable */
          }
        }

        const state = await ms.syncState();
        const [synced, notes] = await Promise.all([
          ms.syncProposals(),
          ms.getConsumableNotes(),
        ]);
        const config = AccountInspector.fromAccount(ms.account);
        setDetectedConfig(config);
        setGuardianState(state);
        setProposals(synced);
        setConsumableNotes(notes);
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
      multisigClient,
      signer,
      guardianUrl,
      guardianCommitment,
      walletSource,
      buildExternalParams,
      midenClient,
    ],
  );

  // Auto-load saved account after initialization completes
  const autoLoadAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoLoadAttemptedRef.current) return;
    if (!multisigClient || !signer || !guardianCommitment) return;

    const savedId = localStorage.getItem("currentWalletId");
    if (!savedId) return;

    const savedSource = localStorage.getItem(
      "currentWalletSource",
    ) as WalletSource | null;
    const savedScheme = localStorage.getItem(
      "currentWalletScheme",
    ) as SignatureScheme | null;

    if (savedSource === "ledger" || walletSource === "ledger") return;
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
        try {
          await registerAccountNoteTag(midenClient, multisig.accountId);
        } catch {
          /* tag may already exist */
        }
      }
      try {
        await midenClient.sync();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await midenClient.sync();
      }
        try {
          await midenClient.notes.fetchPrivate();
      } catch {
        /* no private notes or transport unavailable */
      }

      const state = await multisig.syncState().catch((err: unknown) => {
        if (err instanceof GuardianHttpError && err.code === "account_not_found") {
          setGuardianRegistrationRequired(true);
        }
        throw err;
      });
      setGuardianRegistrationRequired(false);
      const [synced, notes] = await Promise.all([
        multisig.syncProposals(),
        multisig.getConsumableNotes(),
      ]);
      const config = AccountInspector.fromAccount(multisig.account);
      debugLog("handleSync: SUCCEEDED", {
        accountId: multisig.accountId,
        vaultBalances: config?.vaultBalances,
        rawVault: rawVaultSnapshot(multisig.account),
        consumableNotes: notes,
      });
      setGuardianState(state);
      setDetectedConfig(config);
      setProposals(synced);
      setConsumableNotes(notes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      debugLog("handleSync: THREW", {
        accountId: multisig.accountId,
        message,
        vaultAtCatchTime: rawVaultSnapshot(multisig.account),
      });
      if (message.includes("nonce")) {
        try {
          const verify = await multisig.verifyStateCommitment();
          const fallbackConfig = AccountInspector.fromAccount(multisig.account);
          const liveSnapshot = await getLiveAccountSnapshot(multisig);
          debugLog("handleSync: verifyStateCommitment SUCCEEDED (chain confirms local state)", {
            accountId: multisig.accountId,
            verify,
            vaultBalances_fromCachedAccount: fallbackConfig?.vaultBalances,
            cachedAccountVault: rawVaultSnapshot(multisig.account),
            liveAccountVault: liveSnapshot,
          });
          setDetectedConfig(fallbackConfig);
        } catch (verifyErr) {
          debugLog("handleSync: verifyStateCommitment FAILED (chain not yet confirmed)", {
            accountId: multisig.accountId,
            error: verifyErr instanceof Error ? verifyErr.message : String(verifyErr),
          });
        }
      }
      if (message.includes("account nonce is too low to import")) {
        setPendingCandidateWarning(
          "Sync warning: local state is ahead of the on-chain state. " +
            "This can happen right after executing a transaction. Please wait a moment and sync again.",
        );
        setError(null);
      } else {
        setError(formatError(err, "Sync failed"));
      }
    } finally {
      setSyncingState(false);
    }
  }, [multisig, midenClient]);

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
      await multisig.registerOnGuardian();
      if (walletSource === "ledger" && ledger.signer !== latestLedgerSigner.current) {
        throw new Error("Ledger session changed; load the account again.");
      }
      setGuardianRegistrationRequired(false);
      await registerAccountNoteTag(midenClient, multisig.accountId);
      try {
        await requestAccountFunding(multisig);
      } catch {
        // Funding failures are shown separately and can be retried.
      }
      await handleSync();
    } catch (err) {
      setError(formatError(err, "Guardian registration recovery failed"));
    } finally {
      registrationRetryInProgress.current = false;
      setRegisteringOnGuardian(false);
    }
  }, [multisig, midenClient, guardianRegistrationRequired, walletSource, ledger.signer, requestAccountFunding, handleSync]);

  const retryProposalVerification = useCallback(
    async () => {
      await handleSync();
    },
    [handleSync],
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

  const handleCreateAddSignerProposal = useCallback(
    async (commitment: string, increaseThreshold: boolean) => {
      if (!multisig) return;

      let normalizedCommitment: string;
      try {
        normalizedCommitment = normalizeCommitment(commitment);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Invalid commitment");
        return;
      }

      setCreatingProposal(true);
      setError(null);
      setPendingCandidateWarning(null);
      try {
        const newThreshold = increaseThreshold
          ? multisig.threshold + 1
          : undefined;
        await multisig.createAddSignerProposal(normalizedCommitment, { newThreshold });
        setProposals(multisig.listProposals());
        toast.success("Add signer proposal created");
      } catch (err) {
        if (isPendingCandidateError(err)) {
          setPendingCandidateWarning(
            "A previous transaction is still being processed on-chain. " +
              "Please wait for it to be confirmed before creating new proposals.",
          );
        } else {
          setError(
            `Failed to create proposal: ${err instanceof Error ? err.message : "Unknown"}`,
          );
        }
      } finally {
        setCreatingProposal(false);
      }
    },
    [multisig],
  );

  const handleCreateRemoveSignerProposal = useCallback(
    async (signerToRemove: string, newThreshold?: number) => {
      if (!multisig) return;

      setCreatingProposal(true);
      setError(null);
      setPendingCandidateWarning(null);
      try {
        await multisig.createRemoveSignerProposal(signerToRemove, { newThreshold });
        setProposals(multisig.listProposals());
        toast.success("Remove signer proposal created");
      } catch (err) {
        if (isPendingCandidateError(err)) {
          setPendingCandidateWarning(
            "A previous transaction is still being processed on-chain. " +
              "Please wait for it to be confirmed before creating new proposals.",
          );
        } else {
          setError(
            `Failed to create proposal: ${err instanceof Error ? err.message : "Unknown"}`,
          );
        }
      } finally {
        setCreatingProposal(false);
      }
    },
    [multisig],
  );

  const handleCreateChangeThresholdProposal = useCallback(
    async (newThreshold: number) => {
      if (!multisig) return;

      setCreatingProposal(true);
      setError(null);
      setPendingCandidateWarning(null);
      try {
        await multisig.createChangeThresholdProposal(newThreshold);
        setProposals(multisig.listProposals());
        toast.success("Change threshold proposal created");
      } catch (err) {
        if (isPendingCandidateError(err)) {
          setPendingCandidateWarning(
            "A previous transaction is still being processed on-chain. " +
              "Please wait for it to be confirmed before creating new proposals.",
          );
        } else {
          setError(
            `Failed to create proposal: ${err instanceof Error ? err.message : "Unknown"}`,
          );
        }
      } finally {
        setCreatingProposal(false);
      }
    },
    [multisig],
  );

  const handleCreateConsumeNotesProposal = useCallback(
    async (noteIds: string[]) => {
      if (!multisig) return;

      const selectedNotes = consumableNotes.filter((n) => noteIds.includes(n.id));
      debugLog("handleCreateConsumeNotesProposal: notes about to be consumed", {
        noteIds,
        selectedNotes,
      });

      setCreatingProposal(true);
      setError(null);
      setPendingCandidateWarning(null);
      try {
        if (midenClient) await logReceiveFunding(midenClient, multisig, selectedNotes);
        await multisig.createConsumeNotesProposal(noteIds);
        setProposals(multisig.listProposals());
        if (accountFunding.phase === "funding-available") {
          setAccountFunding({ phase: "idle" });
        }
        toast.success("Consume notes proposal created");
      } catch (err) {
        diagnosticLog('receive.FAIL', { accountId: multisig.accountId, noteIds, error: diagnosticError(err) });
        if (isPendingCandidateError(err)) {
          setPendingCandidateWarning(
            "A previous transaction is still being processed on-chain. " +
              "Please wait for it to be confirmed before creating new proposals.",
          );
        } else {
          setError(
            `Failed to create proposal: ${err instanceof Error ? err.message : "Unknown"}`,
          );
        }
      } finally {
        setCreatingProposal(false);
      }
    },
    [accountFunding.phase, multisig, consumableNotes, midenClient],
  );

  const handleCreateP2idProposal = useCallback(
    async (recipientId: string, faucetId: string, amount: bigint) => {
      if (!multisig) return;

      setCreatingProposal(true);
      setError(null);
      setPendingCandidateWarning(null);
      try {
        await multisig.createP2idProposal(recipientId, faucetId, amount);
        setProposals(multisig.listProposals());
        toast.success("Send payment proposal created");
      } catch (err) {
        if (isPendingCandidateError(err)) {
          setPendingCandidateWarning(
            "A previous transaction is still being processed on-chain. " +
              "Please wait for it to be confirmed before creating new proposals.",
          );
        } else {
          setError(
            `Failed to create proposal: ${err instanceof Error ? err.message : "Unknown"}`,
          );
        }
      } finally {
        setCreatingProposal(false);
      }
    },
    [multisig],
  );

  // Relays before the note is executed, not after: a crash between execute
  // and relay leaves the commitment on-chain with contents nowhere (funds
  // stuck), while a crash between relay and execute just leaves a harmless
  // orphaned entry in the transport service. Relaying early also guarantees
  // the block hint sendPrivate captures (the client's current sync height)
  // sits at or before the note's eventual commitment, not after it.
  const handleSendPrivateNote = useCallback(
    async (recipientId: string, faucetId: string, amount: bigint) => {
      if (!multisig || !midenClient) return;

      setPrivateSendProgress({
        step: "creating-proposal",
        totalNotes: 0,
        relayedNotes: 0,
      });
      setError(null);
      setPendingCandidateWarning(null);
      try {
        const scanAfterBlockNum = await midenClient.getSyncHeight();
        const proposal = await multisig.createP2idProposal(
          recipientId,
          faucetId,
          amount,
          { noteType: NoteType.Private },
        );
        setProposals(multisig.listProposals());

        const notes = getOutputNotesFromTxSummary(proposal.txSummary);
        setPrivateSendProgress({
          step: "relaying-notes",
          totalNotes: notes.length,
          relayedNotes: 0,
        });

        for (const note of notes) {
          await relayPrivateNote(midenClient, note, recipientId, scanAfterBlockNum);
          setPrivateSendProgress((prev) => ({
            ...prev,
            relayedNotes: prev.relayedNotes + 1,
          }));
        }

        setPrivateSendProgress((prev) => ({ ...prev, step: "done" }));
        toast.success("Private send proposal created and relayed");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (isPendingCandidateError(err)) {
          setPendingCandidateWarning(
            "A previous transaction is still being processed on-chain. " +
              "Please wait for it to be confirmed before creating new proposals.",
          );
        } else {
          setError(`Failed to send privately: ${message}`);
        }
        setPrivateSendProgress((prev) => ({ ...prev, step: "error", error: message }));
        throw err;
      }
    },
    [multisig, midenClient],
  );

  const resetPrivateSendProgress = useCallback(() => {
    setPrivateSendProgress({ step: "idle", totalNotes: 0, relayedNotes: 0 });
  }, []);

  const handleCreateSwitchGuardianProposal = useCallback(
    async (newEndpoint: string, newPubkey: string) => {
      if (!multisig) return;

      setCreatingProposal(true);
      setError(null);
      setPendingCandidateWarning(null);
      try {
        await multisig.createSwitchGuardianProposal(newEndpoint, newPubkey);
        setProposals(multisig.listProposals());
        toast.success("Switch Guardian proposal created");
      } catch (err) {
        if (isPendingCandidateError(err)) {
          setPendingCandidateWarning(
            "A previous transaction is still being processed on-chain. " +
              "Please wait for it to be confirmed before creating new proposals.",
          );
        } else {
          setError(
            `Failed to create proposal: ${err instanceof Error ? err.message : "Unknown"}`,
          );
        }
      } finally {
        setCreatingProposal(false);
      }
    },
    [multisig],
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

  const multisigRef = useRef(multisig);
  multisigRef.current = multisig;
  const loadedAccountId = multisig?.accountId ?? null;

  useEffect(() => {
    setStuckRecord(loadedAccountId ? loadStuckCandidate(loadedAccountId) : null);
  }, [loadedAccountId]);

  // Only ever expose a Guardian-confirmed record for the account loaded right now.
  const stuckCandidate = useMemo(
    () =>
      stuckRecord?.confirmed && loadedAccountId && stuckRecord.accountId.toLowerCase() === loadedAccountId.toLowerCase()
        ? stuckRecord
        : null,
    [stuckRecord, loadedAccountId],
  );

  const rememberStuckCandidate = useCallback((record: StuckCandidate) => {
    saveStuckCandidate(record);
    setStuckRecord(record);
  }, []);

  const forgetStuckCandidate = useCallback((accountId: string) => {
    clearStuckCandidate(accountId);
    setStuckRecord((current) => (current?.accountId.toLowerCase() === accountId.toLowerCase() ? null : current));
  }, []);

  const handleExecuteProposal = useCallback(
    async (proposalId: string) => {
      if (!multisig || accountOpInFlight.current) return;
      accountOpInFlight.current = true;

      setExecutingProposal(proposalId);
      setError(null);
      setPendingCandidateWarning(null);
      let executing: { id: string; nonce: number } | undefined;
      // The record of an earlier execution, if any. A refused push (409) means
      // this attempt created nothing, so the earlier record is what still counts.
      const earlierRecord = loadStuckCandidate(multisig.accountId);
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

        debugLog("handleExecuteProposal: BEFORE execute", {
          proposalId,
          proposalType: fresh.metadata?.proposalType,
          noteIds: fresh.metadata?.proposalType === "consume_notes" ? fresh.metadata.noteIds : undefined,
          signatureCount: fresh.signatures?.length,
          vaultBefore: rawVaultSnapshot(multisig.account),
        });

        // Write-ahead: if this page dies mid-execute after Guardian accepted the
        // push, the record is what lets this browser recognise the lock as its own.
        rememberStuckCandidate({
          accountId: multisig.accountId,
          proposalId,
          nonce: fresh.nonce,
          startedAt: Date.now(),
          confirmed: false,
        });
        await multisig.executeProposal(proposalId);
        // The transaction landed, so no candidate of this account is stuck any more.
        forgetStuckCandidate(multisig.accountId);
        setProposals(multisig.listProposals());
        toast.success("Proposal executed successfully");

        // Checkpoint: local transaction execution just ran. This reads the vault
        // BEFORE any syncState()/Guardian involvement, to isolate whether local
        // execution itself credited the vault, independent of the sync layer.
        // Logs BOTH the cached `multisig.account` field AND a live fetch straight
        // from the raw client, so we can see directly whether the cached field
        // is stale relative to the true local state.
        debugLog("handleExecuteProposal: immediately AFTER local execute (pre-sync)", {
          proposalId,
          cachedAccountVault: rawVaultSnapshot(multisig.account),
          liveAccountVault: await getLiveAccountSnapshot(multisig),
        });

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
            const state = await multisig.syncState();
            const [synced, notes] = await Promise.all([
              multisig.syncProposals(),
              multisig.getConsumableNotes(),
            ]);
            const config = AccountInspector.fromAccount(multisig.account);
            debugLog("handleExecuteProposal: post-execute sync SUCCEEDED", {
              proposalId,
              vaultBalances: config?.vaultBalances,
              rawVault: rawVaultSnapshot(multisig.account),
              consumableNotesRemaining: notes,
            });
            setGuardianState(state);
            setDetectedConfig(config);
            setProposals(synced);
            setConsumableNotes(notes);
          } catch (syncErr) {
            const message =
              syncErr instanceof Error ? syncErr.message : String(syncErr);
            debugLog("handleExecuteProposal: post-execute sync THREW", {
              proposalId,
              message,
              vaultAtCatchTime: rawVaultSnapshot(multisig.account),
            });
            if (message.includes("nonce")) {
              try {
                const verify = await multisig.verifyStateCommitment();
                const fallbackConfig = AccountInspector.fromAccount(multisig.account);
                const liveSnapshot = await getLiveAccountSnapshot(multisig);
                debugLog("handleExecuteProposal: verifyStateCommitment SUCCEEDED (chain confirms local state)", {
                  proposalId,
                  verify,
                  vaultBalances_fromCachedAccount: fallbackConfig?.vaultBalances,
                  cachedAccountVault: rawVaultSnapshot(multisig.account),
                  liveAccountVault: liveSnapshot,
                });
                setDetectedConfig(fallbackConfig);
              } catch (verifyErr) {
                debugLog("handleExecuteProposal: verifyStateCommitment FAILED (chain not yet confirmed)", {
                  proposalId,
                  error: verifyErr instanceof Error ? verifyErr.message : String(verifyErr),
                });
              }
            }
            if (message.includes("account nonce is too low to import")) {
              setPendingCandidateWarning(
                "Sync warning: local state is ahead of the on-chain state. " +
                  "This can happen right after executing a transaction. Please wait a moment and sync again.",
              );
            }
          } finally {
            setSyncingState(false);
          }
        }
      } catch (err) {
        const message = describeExecutionError(err, "Execute failed");
        if (isPendingCandidateError(err)) {
          // Some execution already holds the account's Guardian lock. Only an
          // execution this browser started may be released from here; any other
          // lock may be a cosigner's transaction that is still landing.
          const own = earlierRecord;
          if (own) rememberStuckCandidate(own);
          else forgetStuckCandidate(multisig.accountId);
          if (!own) {
            setPendingCandidateWarning(
              "Another execution of this account is pending on Guardian, possibly from another signer. " +
                "Wait for it to confirm, then sync.",
            );
          } else if (!claimable(own)) {
            setPendingCandidateWarning(
              "An execution started from this browser a moment ago may still be finishing. " +
                "Wait a few minutes, sync, and try again.",
            );
          } else {
            // Sync first: if the earlier transaction landed, the lock resolves on
            // its own and there is nothing to release.
            await handleSync().catch(() => {});
            const probe = await probeCandidate(multisig, own.nonce);
            if (probe === "pending") {
              rememberStuckCandidate({ ...own, confirmed: true });
              setPendingCandidateWarning(
                "An earlier execution from this browser was interrupted after Guardian locked the account " +
                  "for it, and it has not landed on-chain.",
              );
            } else if (probe === "resolved") {
              forgetStuckCandidate(multisig.accountId);
              setPendingCandidateWarning(
                "The earlier execution from this browser is no longer pending. Sync and check the " +
                  "current state before trying again.",
              );
            } else {
              setPendingCandidateWarning(
                "Could not check the pending execution with Guardian. Sync and try again.",
              );
            }
          }
        } else {
          setError(message);
          toast.error(message);
          // If the failure came after Guardian accepted the push, this browser
          // now holds a candidate that will never land. Confirm with Guardian
          // before offering to release it; keep the record if Guardian can't say.
          if (executing) {
            const probe = await probeCandidate(multisig, executing.nonce);
            const record = loadStuckCandidate(multisig.accountId);
            if (probe === "pending" && record?.nonce === executing.nonce) {
              rememberStuckCandidate({ ...record, confirmed: true });
              setPendingCandidateWarning(
                "Guardian locked the account for this execution before it failed. Unlock it to continue.",
              );
            } else if (probe === "resolved") {
              forgetStuckCandidate(multisig.accountId);
            }
          }
        }
        throw err;
      } finally {
        setExecutingProposal(null);
        accountOpInFlight.current = false;
      }
    },
    [multisig, midenClient, handleSync, forgetStuckCandidate, rememberStuckCandidate],
  );

  const releaseStuckCandidateAndRetry = useCallback(async () => {
    const ms = multisig;
    const record = stuckCandidate;
    if (!ms || !record?.confirmed || accountOpInFlight.current) return;
    if (record.accountId.toLowerCase() !== ms.accountId.toLowerCase()) return;
    accountOpInFlight.current = true;
    const { accountId, proposalId, nonce } = record;
    // Bail out of follow-up steps if the user switched account meanwhile.
    const stillCurrent = () => multisigRef.current === ms;

    setReleasingCandidate(true);
    setError(null);
    setPendingCandidateWarning("Unlocking your account. Guardian first confirms the transaction did not land, which can take up to a minute.");
    let retry = false;
    try {
      let outcome;
      try {
        outcome = await releasePendingCandidate(ms, nonce);
      } catch (err) {
        if (!stillCurrent()) return;
        setPendingCandidateWarning(null);
        setError(`${describeExecutionError(err, "Could not complete the release")} It is safe to try again.`);
        return;
      }
      debugLog("releaseStuckCandidateAndRetry: outcome", { accountId, proposalId, nonce, outcome });
      if (!stillCurrent()) return;

      switch (outcome) {
        case "abandoned": {
          // Guardian confirmed the transaction did not land and discarded it.
          forgetStuckCandidate(accountId);
          let proposalSurvived: boolean;
          try {
            const synced = await ms.syncProposals();
            proposalSurvived = synced.some((p) => p.id === proposalId && isProposalActionable(p));
          } catch {
            if (!stillCurrent()) return;
            setPendingCandidateWarning(
              "The stuck transaction was released, but proposals could not be refreshed. " +
                "Sync before executing or re-creating anything.",
            );
            return;
          }
          if (!stillCurrent()) return;
          if (proposalSurvived) {
            setPendingCandidateWarning(null);
            toast.success("Stuck transaction released. Retrying execute…");
            retry = true;
            return;
          }
          await handleSync().catch(() => {});
          if (!stillCurrent()) return;
          toast.success("Stuck transaction released. The account is unlocked.");
          setPendingCandidateWarning(
            "The stuck transaction was released and Guardian discarded its proposal. " +
              "Nothing from it was applied on-chain, so create the proposal again to continue.",
          );
          return;
        }
        case "retained":
          // Unlocked, but Guardian could not rule out that it landed; it may
          // still be promoted. Never present this as "did not happen".
          forgetStuckCandidate(accountId);
          await handleSync().catch(() => {});
          if (!stillCurrent()) return;
          setPendingCandidateWarning(
            "Guardian unlocked the account but could not confirm whether the earlier transaction landed. " +
              "Do not re-create it yet: sync again in a few minutes and check balances and history first.",
          );
          return;
        case "landed":
          forgetStuckCandidate(accountId);
          setPendingCandidateWarning(
            "The earlier transaction did land on-chain, so it was not released. Syncing account state…",
          );
          await handleSync().catch(() => {});
          return;
        case "timeout":
          setPendingCandidateWarning(
            "Guardian has not resolved the release yet. It is safe to try again in a moment.",
          );
          return;
        default:
          forgetStuckCandidate(accountId);
          await handleSync().catch(() => {});
          if (!stillCurrent()) return;
          setPendingCandidateWarning(
            "Guardian no longer holds this execution as pending; it was resolved some other way. " +
              "Check the synced state before retrying.",
          );
      }
    } finally {
      accountOpInFlight.current = false;
      setReleasingCandidate(false);
    }
    if (retry && stillCurrent()) {
      await handleExecuteProposal(proposalId).catch(() => {
        /* handleExecuteProposal reports failures through `error` */
      });
    }
  }, [multisig, stuckCandidate, handleExecuteProposal, handleSync, forgetStuckCandidate]);

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
      stuckCandidate,
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
      releaseStuckCandidateAndRetry,
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
      setGuardianUrl,
      connectToGuardian,
      dismissWarning: () => setPendingCandidateWarning(null),
      setError,

      connectMidenWallet,
      disconnectMidenWallet,
      openParaModal: () => setParaModalOpen(true),
      paraModalOpen,
      closeParaModal: () => setParaModalOpen(false),

      // Deprecated aliases
      psmUrl: guardianUrl,
      psmStatus: guardianStatus,
      connectToPsm: connectToGuardian,
      setPsmUrl: setGuardianUrl,
      handleCreateSendProposal: handleCreateP2idProposal,
      handleCreateSwitchPsmProposal: handleCreateSwitchGuardianProposal,
      registeringOnPsm: registeringOnGuardian,
    }),
    [
      ledger,
      setWalletSource,
      midenClient,
      multisigClient,
      signer,
      multisig,
      error,
      pendingCandidateWarning,
      stuckCandidate,
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
      releaseStuckCandidateAndRetry,
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
