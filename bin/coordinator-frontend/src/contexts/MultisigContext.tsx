'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import {
  type Multisig,
  type MultisigClient,
  type AccountState,
  type DetectedMultisigConfig,
  type TransactionProposal,
  type SignatureScheme,
  type ProcedureThreshold,
  type ParaSigningContext,
} from '@openzeppelin/miden-multisig-client';
import { PsmHttpError } from '@openzeppelin/psm-client';
import { WebClient } from '@miden-sdk/miden-sdk';

import { normalizeCommitment } from '@/lib/helpers';
import { formatError, classifyWalletError } from '@/lib/errors';
import { clearMidenDatabase, createWebClient, initializeSigner as initSigner, loadSignerKeys, saveSignerKeys } from '@/lib/initClient';
import {
  initMultisigClient,
  createMultisigAccount,
  loadMultisigAccount,
  createSigner,
} from '@/lib/multisigApi';
import type { ExternalSignerParams } from '@/lib/multisigApi';
import { PSM_ENDPOINT } from '@/config/psm';
import type { SignerInfo } from '@/types/psm';
import type { WalletSource } from '@/wallets/types';
import { useParaSession } from '@/hooks/useParaSession';
import { useMidenWallet } from '@/hooks/useMidenWallet';
import { MidenWalletAdapter } from '@demox-labs/miden-wallet-adapter-miden';

function isPendingCandidateError(error: unknown): boolean {
  const errorStr = error instanceof Error ? error.message : String(error);
  return (
    errorStr.includes('non-canonical delta pending') ||
    errorStr.includes('ConflictPendingDelta')
  );
}

interface MultisigContextValue {
  // Core state
  webClient: WebClient | null;
  multisigClient: MultisigClient | null;
  signer: SignerInfo | null;
  multisig: Multisig | null;
  error: string | null;
  pendingCandidateWarning: string | null;

  // PSM state
  psmUrl: string;
  psmStatus: 'connected' | 'connecting' | 'error';
  psmCommitment: string;
  psmPublicKey: string | undefined;
  psmState: AccountState | null;

  // Multisig data
  detectedConfig: DetectedMultisigConfig | null;
  proposals: TransactionProposal[];
  consumableNotes: Array<{ id: string; assets: Array<{ faucetId: string; amount: bigint }> }>;

  // Wallet state
  walletSource: WalletSource;
  activeCommitment: string | null;
  activeScheme: SignatureScheme;
  paraSession: { connected: boolean; commitment: string | null; publicKey: string | null };
  midenWalletSession: { connected: boolean; commitment: string | null };

  // Loading flags
  creating: boolean;
  registeringOnPsm: boolean;
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
  handleLoad: (accountId: string, signatureScheme?: SignatureScheme) => Promise<void>;
  handleSync: () => Promise<void>;
  handleSignProposal: (proposalId: string) => Promise<void>;
  handleExecuteProposal: (proposalId: string) => Promise<void>;
  handleCreateSendProposal: (recipientId: string, faucetId: string, amount: bigint) => Promise<void>;
  handleCreateConsumeNotesProposal: (noteIds: string[]) => Promise<void>;
  handleCreateAddSignerProposal: (commitment: string, increaseThreshold: boolean) => Promise<void>;
  handleCreateRemoveSignerProposal: (signerToRemove: string, newThreshold?: number) => Promise<void>;
  handleCreateChangeThresholdProposal: (newThreshold: number) => Promise<void>;
  handleCreateSwitchPsmProposal: (newEndpoint: string, newPubkey: string) => Promise<void>;
  handleExportProposal: (proposalId: string) => void;
  handleSignProposalOffline: (proposalId: string) => Promise<void>;
  handleImportProposal: (json: string) => void;
  handleDisconnect: () => void;
  setWalletSource: (source: WalletSource) => void;
  setPsmUrl: (url: string) => void;
  connectToPsm: (url: string) => Promise<void>;
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
  if (!ctx) throw new Error('useMultisig must be used within MultisigProvider');
  return ctx;
}

export function MultisigProvider({ children }: { children: React.ReactNode }) {
  const [webClient, setWebClient] = useState<WebClient | null>(null);
  const [multisigClient, setMultisigClient] = useState<MultisigClient | null>(null);
  const [signer, setSigner] = useState<SignerInfo | null>(null);
  const [generatingSigner, setGeneratingSigner] = useState(false);
  const [multisig, setMultisig] = useState<Multisig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCandidateWarning, setPendingCandidateWarning] = useState<string | null>(null);

  const [psmUrl, setPsmUrl] = useState(PSM_ENDPOINT);
  const [psmStatus, setPsmStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');
  const [psmCommitment, setPsmCommitment] = useState('');
  const [psmPublicKey, setPsmPublicKey] = useState<string | undefined>(undefined);
  const [psmState, setPsmState] = useState<AccountState | null>(null);

  const [creating, setCreating] = useState(false);
  const [registeringOnPsm, setRegisteringOnPsm] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [detectedConfig, setDetectedConfig] = useState<DetectedMultisigConfig | null>(null);
  const [syncingState, setSyncingState] = useState(false);

  const [proposals, setProposals] = useState<TransactionProposal[]>([]);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [signingProposal, setSigningProposal] = useState<string | null>(null);
  const [executingProposal, setExecutingProposal] = useState<string | null>(null);

  const [consumableNotes, setConsumableNotes] = useState<Array<{ id: string; assets: Array<{ faucetId: string; amount: bigint }> }>>([]);

  const [walletSource, setWalletSource] = useState<WalletSource>('local');
  const [paraModalOpen, setParaModalOpen] = useState(false);

  const { session: paraSession, paraClient, getWalletId } = useParaSession();
  const [midenWalletAdapter] = useState(() => new MidenWalletAdapter({ appName: 'Miden Multisig' }));
  const { session: midenWalletSession, connect: connectMidenWalletRaw, disconnect: disconnectMidenWallet, signBytes, connectError: midenWalletConnectError } = useMidenWallet(midenWalletAdapter);

  // Show Miden Wallet connection errors
  useEffect(() => {
    if (midenWalletConnectError) {
      toast.error(midenWalletConnectError);
    }
  }, [midenWalletConnectError]);

  // Auto-switch wallet source when an external wallet connects
  useEffect(() => {
    if (paraSession.connected) {
      setWalletSource('para');
      if (paraModalOpen) setParaModalOpen(false);
    }
  }, [paraSession.connected, paraModalOpen]);

  useEffect(() => {
    if (midenWalletSession.connected) {
      setWalletSource('miden-wallet');
    }
  }, [midenWalletSession.connected]);

  const activeCommitment = useMemo(() => {
    if (walletSource === 'para' && paraSession.connected) return paraSession.commitment;
    if (walletSource === 'miden-wallet' && midenWalletSession.connected) return midenWalletSession.commitment;
    if (!signer) return null;
    return signer.activeScheme === 'ecdsa' ? signer.ecdsa.commitment : signer.falcon.commitment;
  }, [walletSource, paraSession, midenWalletSession, signer]);

  const activeScheme = useMemo((): SignatureScheme => {
    if (walletSource === 'para') return 'ecdsa';
    if (walletSource === 'miden-wallet' && midenWalletSession.scheme) return midenWalletSession.scheme;
    return signer?.activeScheme ?? 'falcon';
  }, [walletSource, midenWalletSession, signer]);

  const buildExternalParams = useCallback((): ExternalSignerParams | undefined => {
    if (walletSource === 'para' && paraSession.connected && paraClient) {
      const walletId = getWalletId();
      if (!walletId || !paraSession.commitment || !paraSession.publicKey) return undefined;
      return {
        walletSource: 'para',
        paraContext: {
          para: paraClient as ParaSigningContext,
          walletId,
          commitment: paraSession.commitment,
          publicKey: paraSession.publicKey,
        },
      };
    }
    if (walletSource === 'miden-wallet' && midenWalletSession.connected) {
      if (!midenWalletSession.commitment || !midenWalletSession.scheme) return undefined;
      return {
        walletSource: 'miden-wallet',
        midenWalletContext: {
          wallet: { signBytes },
          commitment: midenWalletSession.commitment,
          scheme: midenWalletSession.scheme,
        },
      };
    }
    return undefined;
  }, [walletSource, paraSession, paraClient, getWalletId, midenWalletSession, signBytes]);

  const connectToPsm = useCallback(
    async (url: string, client?: WebClient): Promise<void> => {
      setPsmStatus('connecting');
      setError(null);
      try {
        const wc = client ?? webClient;
        if (!wc) {
          const response = await fetch(`${url}/pubkey`);
          const data = await response.json();
          setPsmCommitment(data.commitment ?? '');
          setPsmPublicKey(data.pubkey);
          setPsmStatus('connected');
          return;
        }

        const { client: msClient, psmCommitment: commitment, psmPubkey: pubkey } =
          await initMultisigClient(wc, url);
        setPsmCommitment(commitment);
        setPsmPublicKey(pubkey);
        setMultisigClient(msClient);
        setPsmStatus('connected');

        if (multisig && signer && psmState?.stateDataBase64) {
          setRegisteringOnPsm(true);
          try {
            let ackPublicKey = pubkey;
            if (signer.activeScheme === 'ecdsa' && !ackPublicKey) {
              const { pubkey: fetched } = await msClient.psmClient.getPubkey('ecdsa');
              ackPublicKey = fetched;
              setPsmPublicKey(fetched);
            }
            const clientSigner = createSigner(signer, signer.activeScheme, buildExternalParams());
            const reloadedMs = await loadMultisigAccount(
              msClient,
              multisig.accountId,
              clientSigner,
              ackPublicKey,
            );
            setMultisig(reloadedMs);

            const { proposals: synced, state, notes, config } = await reloadedMs.syncAll();
            setPsmState(state);
            setDetectedConfig(config);
            setProposals(synced);
            setConsumableNotes(notes);

            toast.success('Account loaded from PSM');
          } catch (loadErr) {
            const isNotFound = loadErr instanceof PsmHttpError && loadErr.status === 404;
            const isNonceTooLow = loadErr instanceof Error && loadErr.message.includes('nonce') && loadErr.message.includes('too low');

            if (isNotFound || isNonceTooLow) {
              try {
                await multisig.switchPsm(msClient.psmClient);

                const { proposals: synced, state, notes, config } = await multisig.syncAll();
                setPsmState(state);
                setDetectedConfig(config);
                setProposals(synced);
                setConsumableNotes(notes);

                toast.success('Account registered on new PSM');
              } catch (registerErr) {
                setError(`Failed to register account on new PSM: ${formatError(registerErr)}`);
              }
            } else {
              setError(`Failed to load account from PSM: ${formatError(loadErr)}`);
            }
          } finally {
            setRegisteringOnPsm(false);
          }
        }
      } catch (err) {
        const msg = formatError(err);
        setPsmStatus('error');
        setPsmCommitment('');
        setPsmPublicKey(undefined);
        setError(`Failed to connect to PSM: ${msg}`);
      }
    },
    [webClient, multisig, signer, psmState, buildExternalParams]
  );

  // Initialization
  useEffect(() => {
    const init = async () => {
      try {
        await clearMidenDatabase();

        const client = await createWebClient();
        setWebClient(client);

        await connectToPsm(psmUrl, client);

        setGeneratingSigner(true);
        let signerInfo = await loadSignerKeys();
        if (!signerInfo) {
          signerInfo = initSigner();
          await saveSignerKeys(signerInfo);
        }
        setSigner(signerInfo);
      } catch (err) {
        setError(formatError(err, 'Initialization failed'));
      } finally {
        setGeneratingSigner(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = useCallback(async (
    otherSignerCommitments: string[],
    threshold: number,
    procedureThresholds?: ProcedureThreshold[],
    signatureScheme: SignatureScheme = 'falcon',
  ) => {
    if (!multisigClient || !signer || !psmCommitment) {
      setError('Client not initialized. Try reconnecting to PSM.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      setSigner((prev) => (prev ? { ...prev, activeScheme: signatureScheme } : prev));
      let ackPublicKey = psmPublicKey;
      let accountPsmCommitment = psmCommitment;
      if (signatureScheme === 'ecdsa') {
        const { pubkey, commitment } = await multisigClient.psmClient.getPubkey('ecdsa');
        if (!ackPublicKey) {
          ackPublicKey = pubkey;
          setPsmPublicKey(pubkey);
        }
        accountPsmCommitment = commitment;
        setPsmCommitment(commitment);
      }

      const externalParams = buildExternalParams();
      const clientSigner = createSigner(signer, signatureScheme, externalParams);
      const signerCommitment = externalParams?.paraContext?.commitment
        ?? externalParams?.midenWalletContext?.commitment
        ?? (signatureScheme === 'ecdsa' ? signer.ecdsa.commitment : signer.falcon.commitment);

      const ms = await createMultisigAccount(
        multisigClient,
        signerCommitment,
        otherSignerCommitments,
        threshold,
        accountPsmCommitment,
        clientSigner,
        ackPublicKey,
        procedureThresholds,
        signatureScheme
      );
      setMultisig(ms);

      // Persist account ID so middleware allows dashboard access
      if (ms.accountId) {
        localStorage.setItem('currentWalletId', ms.accountId);
        document.cookie = `currentWalletId=${ms.accountId}; path=/; max-age=31536000`;
      }

      setRegisteringOnPsm(true);
      try {
        await ms.registerOnPsm();
        const { proposals: synced, state, notes, config } = await ms.syncAll();
        setDetectedConfig(config);
        setPsmState(state);
        setProposals(synced);
        setConsumableNotes(notes);
      } catch (psmErr) {
        setError(`Created but failed to register on PSM: ${psmErr instanceof Error ? psmErr.message : 'Unknown'}`);
      } finally {
        setRegisteringOnPsm(false);
      }
    } catch (err) {
      if (walletSource !== 'local') {
        setError(classifyWalletError(err));
      } else {
        setError(formatError(err, 'Failed to create'));
      }
    } finally {
      setCreating(false);
    }
  }, [multisigClient, signer, psmCommitment, psmPublicKey, walletSource, buildExternalParams]);

  const handleLoad = useCallback(async (accountId: string, signatureScheme: SignatureScheme = 'falcon') => {
    if (!multisigClient || !signer) {
      setError('Client not initialized. Try reconnecting to PSM.');
      return;
    }
    if (!psmCommitment) {
      setPsmStatus('error');
      setError('Not connected to PSM. Check the endpoint and try again.');
      return;
    }

    let normalizedId = accountId;
    if (!normalizedId.startsWith('0x')) {
      normalizedId = `0x${normalizedId}`;
    }

    setLoadingAccount(true);
    setError(null);
    setDetectedConfig(null);
    try {
      setSigner((prev) => (prev ? { ...prev, activeScheme: signatureScheme } : prev));
      let ackPublicKey = psmPublicKey;
      if (signatureScheme === 'ecdsa' && !ackPublicKey) {
        const { pubkey } = await multisigClient.psmClient.getPubkey('ecdsa');
        ackPublicKey = pubkey;
        setPsmPublicKey(pubkey);
      }

      const externalParams = buildExternalParams();
      const clientSigner = createSigner(signer, signatureScheme, externalParams);

      const ms = await loadMultisigAccount(
        multisigClient,
        normalizedId,
        clientSigner,
        ackPublicKey,
      );
      setMultisig(ms);

      // Persist account ID so middleware allows dashboard access
      if (ms.accountId) {
        localStorage.setItem('currentWalletId', ms.accountId);
        document.cookie = `currentWalletId=${ms.accountId}; path=/; max-age=31536000`;
      }

      const { proposals: synced, state, notes, config } = await ms.syncAll();
      setDetectedConfig(config);
      setPsmState(state);
      setProposals(synced);
      setConsumableNotes(notes);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown';
      if (message.includes('404') || message.includes('not found')) {
        setError('Account not found on PSM');
      } else {
        setError(`Failed to load: ${message}`);
      }
    } finally {
      setLoadingAccount(false);
    }
  }, [multisigClient, signer, psmCommitment, psmPublicKey, buildExternalParams]);

  // Auto-load saved account after initialization completes
  const autoLoadAttemptedRef = useRef(false);
  useEffect(() => {
    if (autoLoadAttemptedRef.current) return;
    if (!multisigClient || !signer || !psmCommitment) return;
    const savedId = localStorage.getItem('currentWalletId');
    if (!savedId) return;
    autoLoadAttemptedRef.current = true;
    handleLoad(savedId);
  }, [multisigClient, signer, psmCommitment, handleLoad]);

  const handleSync = useCallback(async () => {
    if (!multisig || !webClient) return;

    setSyncingState(true);
    setError(null);
    setPendingCandidateWarning(null);
    try {
      try {
        await webClient.syncState();
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500));
        await webClient.syncState();
      }

      const { proposals: synced, state, notes, config } = await multisig.syncAll();
      setPsmState(state);
      setDetectedConfig(config);
      setProposals(synced);
      setConsumableNotes(notes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('account nonce is too low to import')) {
        setPendingCandidateWarning(
          'Sync warning: local state is ahead of the on-chain state. ' +
          'This can happen right after executing a transaction. Please wait a moment and sync again.'
        );
        setError(null);
      } else {
        setError(formatError(err, 'Sync failed'));
      }
    } finally {
      setSyncingState(false);
    }
  }, [multisig, webClient]);

  const handleCreateAddSignerProposal = useCallback(async (commitment: string, increaseThreshold: boolean) => {
    if (!multisig) return;

    let normalizedCommitment: string;
    try {
      normalizedCommitment = normalizeCommitment(commitment);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid commitment');
      return;
    }

    setCreatingProposal(true);
    setError(null);
    setPendingCandidateWarning(null);
    try {
      const newThreshold = increaseThreshold ? multisig.threshold + 1 : undefined;
      const { proposals } = await multisig.createAddSignerProposal(normalizedCommitment, { newThreshold });
      setProposals(proposals);
      toast.success('Add signer proposal created');
    } catch (err) {
      if (isPendingCandidateError(err)) {
        setPendingCandidateWarning(
          'A previous transaction is still being processed on-chain. ' +
          'Please wait for it to be confirmed before creating new proposals.'
        );
      } else {
        setError(`Failed to create proposal: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    } finally {
      setCreatingProposal(false);
    }
  }, [multisig]);

  const handleCreateRemoveSignerProposal = useCallback(async (signerToRemove: string, newThreshold?: number) => {
    if (!multisig) return;

    setCreatingProposal(true);
    setError(null);
    setPendingCandidateWarning(null);
    try {
      const { proposals } = await multisig.createRemoveSignerProposal(signerToRemove, { newThreshold });
      setProposals(proposals);
      toast.success('Remove signer proposal created');
    } catch (err) {
      if (isPendingCandidateError(err)) {
        setPendingCandidateWarning(
          'A previous transaction is still being processed on-chain. ' +
          'Please wait for it to be confirmed before creating new proposals.'
        );
      } else {
        setError(`Failed to create proposal: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    } finally {
      setCreatingProposal(false);
    }
  }, [multisig]);

  const handleCreateChangeThresholdProposal = useCallback(async (newThreshold: number) => {
    if (!multisig) return;

    setCreatingProposal(true);
    setError(null);
    setPendingCandidateWarning(null);
    try {
      const { proposals } = await multisig.createChangeThresholdProposal(newThreshold);
      setProposals(proposals);
      toast.success('Change threshold proposal created');
    } catch (err) {
      if (isPendingCandidateError(err)) {
        setPendingCandidateWarning(
          'A previous transaction is still being processed on-chain. ' +
          'Please wait for it to be confirmed before creating new proposals.'
        );
      } else {
        setError(`Failed to create proposal: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    } finally {
      setCreatingProposal(false);
    }
  }, [multisig]);

  const handleCreateConsumeNotesProposal = useCallback(async (noteIds: string[]) => {
    if (!multisig) return;

    setCreatingProposal(true);
    setError(null);
    setPendingCandidateWarning(null);
    try {
      const { proposals } = await multisig.createConsumeNotesProposal(noteIds);
      setProposals(proposals);
      toast.success('Consume notes proposal created');
    } catch (err) {
      if (isPendingCandidateError(err)) {
        setPendingCandidateWarning(
          'A previous transaction is still being processed on-chain. ' +
          'Please wait for it to be confirmed before creating new proposals.'
        );
      } else {
        setError(`Failed to create proposal: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    } finally {
      setCreatingProposal(false);
    }
  }, [multisig]);

  const handleCreateSendProposal = useCallback(async (recipientId: string, faucetId: string, amount: bigint) => {
    if (!multisig) return;

    setCreatingProposal(true);
    setError(null);
    setPendingCandidateWarning(null);
    try {
      const { proposals } = await multisig.createSendProposal(recipientId, faucetId, amount);
      setProposals(proposals);
      toast.success('Send payment proposal created');
    } catch (err) {
      if (isPendingCandidateError(err)) {
        setPendingCandidateWarning(
          'A previous transaction is still being processed on-chain. ' +
          'Please wait for it to be confirmed before creating new proposals.'
        );
      } else {
        setError(`Failed to create proposal: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    } finally {
      setCreatingProposal(false);
    }
  }, [multisig]);

  const handleCreateSwitchPsmProposal = useCallback(async (newEndpoint: string, newPubkey: string) => {
    if (!multisig) return;

    setCreatingProposal(true);
    setError(null);
    setPendingCandidateWarning(null);
    try {
      const { proposals } = await multisig.createSwitchPsmProposal(newEndpoint, newPubkey);
      setProposals(proposals);
      toast.success('Switch PSM proposal created');
    } catch (err) {
      if (isPendingCandidateError(err)) {
        setPendingCandidateWarning(
          'A previous transaction is still being processed on-chain. ' +
          'Please wait for it to be confirmed before creating new proposals.'
        );
      } else {
        setError(`Failed to create proposal: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    } finally {
      setCreatingProposal(false);
    }
  }, [multisig]);

  const handleSignProposal = useCallback(async (proposalId: string) => {
    if (!multisig) return;

    setSigningProposal(proposalId);
    setError(null);
    try {
      const proposals = await multisig.signTransactionProposal(proposalId);
      setProposals(proposals);
    } catch (err) {
      if (walletSource !== 'local') {
        setError(classifyWalletError(err));
      } else {
        setError(`Failed to sign: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    } finally {
      setSigningProposal(null);
    }
  }, [multisig, walletSource]);

  const handleExecuteProposal = useCallback(async (proposalId: string) => {
    if (!multisig) return;

    setExecutingProposal(proposalId);
    setError(null);
    setPendingCandidateWarning(null);
    try {
      await multisig.executeTransactionProposal(proposalId);
      toast.success('Proposal executed successfully');

      // Sync after execution
      if (webClient) {
        setSyncingState(true);
        try {
          try {
            await webClient.syncState();
          } catch {
            await new Promise(resolve => setTimeout(resolve, 500));
            await webClient.syncState();
          }
          const { proposals: synced, state, notes, config } = await multisig.syncAll();
          setPsmState(state);
          setDetectedConfig(config);
          setProposals(synced);
          setConsumableNotes(notes);
        } catch (syncErr) {
          const message = syncErr instanceof Error ? syncErr.message : String(syncErr);
          if (message.includes('account nonce is too low to import')) {
            setPendingCandidateWarning(
              'Sync warning: local state is ahead of the on-chain state. ' +
              'This can happen right after executing a transaction. Please wait a moment and sync again.'
            );
          }
        } finally {
          setSyncingState(false);
        }
      }
    } catch (err) {
      const message = formatError(err, 'Execute failed');
      if (isPendingCandidateError(err)) {
        setPendingCandidateWarning(
          'A previous transaction is still being processed on-chain. ' +
          'Please wait for it to be confirmed before executing proposals.'
        );
      } else {
        setError(message);
        toast.error(message);
      }
    } finally {
      setExecutingProposal(null);
    }
  }, [multisig, webClient]);

  const handleExportProposal = useCallback((proposalId: string) => {
    if (!multisig) return;

    try {
      const json = multisig.exportTransactionProposalToJson(proposalId);
      navigator.clipboard.writeText(json);
      toast.success('Proposal JSON copied to clipboard');
    } catch (err) {
      setError(`Failed to export: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }, [multisig]);

  const handleSignProposalOffline = useCallback(async (proposalId: string) => {
    if (!multisig) return;

    try {
      const json = await multisig.signTransactionProposalOffline(proposalId);
      navigator.clipboard.writeText(json);
      setProposals(multisig.listTransactionProposals());
      toast.success('Signed! Updated proposal JSON copied to clipboard');
    } catch (err) {
      setError(`Failed to sign offline: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }, [multisig]);

  const handleImportProposal = useCallback((json: string) => {
    if (!multisig || !json.trim()) return;

    try {
      const { proposal, proposals } = multisig.importTransactionProposal(json.trim());
      setProposals(proposals);
      toast.success(`Proposal imported: ${proposal.id.slice(0, 12)}...`);
    } catch (err) {
      setError(`Failed to import: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }, [multisig]);

  const handleDisconnect = useCallback(() => {
    setMultisig(null);
    setPsmState(null);
    setProposals([]);
    setError(null);
    setDetectedConfig(null);
    setConsumableNotes([]);
  }, []);

  const connectMidenWallet = useCallback(async () => {
    try {
      await connectMidenWalletRaw();
    } catch (err) {
      toast.error(classifyWalletError(err));
    }
  }, [connectMidenWalletRaw]);

  const value = useMemo((): MultisigContextValue => ({
    webClient,
    multisigClient,
    signer,
    multisig,
    error,
    pendingCandidateWarning,

    psmUrl,
    psmStatus,
    psmCommitment,
    psmPublicKey,
    psmState,

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
    registeringOnPsm,
    loadingAccount,
    syncingState,
    creatingProposal,
    signingProposal,
    executingProposal,
    generatingSigner,

    handleCreate,
    handleLoad,
    handleSync,
    handleSignProposal,
    handleExecuteProposal,
    handleCreateSendProposal,
    handleCreateConsumeNotesProposal,
    handleCreateAddSignerProposal,
    handleCreateRemoveSignerProposal,
    handleCreateChangeThresholdProposal,
    handleCreateSwitchPsmProposal,
    handleExportProposal,
    handleSignProposalOffline,
    handleImportProposal,
    handleDisconnect,
    setWalletSource,
    setPsmUrl,
    connectToPsm,
    dismissWarning: () => setPendingCandidateWarning(null),
    setError,

    connectMidenWallet,
    disconnectMidenWallet,
    openParaModal: () => setParaModalOpen(true),
    paraModalOpen,
    closeParaModal: () => setParaModalOpen(false),
  }), [
    webClient, multisigClient, signer, multisig, error, pendingCandidateWarning,
    psmUrl, psmStatus, psmCommitment, psmPublicKey, psmState,
    detectedConfig, proposals, consumableNotes,
    walletSource, activeCommitment, activeScheme,
    paraSession.connected, paraSession.commitment, paraSession.publicKey,
    midenWalletSession.connected, midenWalletSession.commitment,
    creating, registeringOnPsm, loadingAccount, syncingState,
    creatingProposal, signingProposal, executingProposal, generatingSigner,
    handleCreate, handleLoad, handleSync,
    handleSignProposal, handleExecuteProposal,
    handleCreateSendProposal, handleCreateConsumeNotesProposal,
    handleCreateAddSignerProposal, handleCreateRemoveSignerProposal,
    handleCreateChangeThresholdProposal, handleCreateSwitchPsmProposal,
    handleExportProposal, handleSignProposalOffline, handleImportProposal,
    handleDisconnect, connectToPsm,
    connectMidenWallet, disconnectMidenWallet, paraModalOpen,
  ]);

  return (
    <MultisigContext.Provider value={value}>
      {children}
    </MultisigContext.Provider>
  );
}
