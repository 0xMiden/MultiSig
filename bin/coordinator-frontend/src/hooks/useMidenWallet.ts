'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MessageSignerWalletAdapter } from '@miden-sdk/miden-wallet-adapter-base';
import {
  WalletAdapterNetwork,
  PrivateDataPermission,
} from '@miden-sdk/miden-wallet-adapter-base';
import { PublicKeyFormat } from '@openzeppelin/miden-multisig-client';
import type { ExternalWalletState } from '@/wallets/types';
import { MIDEN_NETWORK } from '@/config/psm';

/** The Miden Wallet network matching this deployment's network. */
function walletNetwork(): WalletAdapterNetwork {
  switch (MIDEN_NETWORK) {
    case 'devnet': return WalletAdapterNetwork.Devnet;
    case 'testnet': return WalletAdapterNetwork.Testnet;
    case 'local': return WalletAdapterNetwork.Localnet;
    default:
      throw new Error(`The Miden Wallet has no ${MIDEN_NETWORK} network; set NEXT_PUBLIC_MIDEN_NETWORK to devnet, testnet or local.`);
  }
}

export function useMidenWallet(adapter: MessageSignerWalletAdapter | null) {
  const [session, setSession] = useState<ExternalWalletState>({
    source: 'miden-wallet',
    connected: false,
    publicKey: null,
    commitment: null,
    scheme: null,
  });
  const [connectError, setConnectError] = useState<string | null>(null);
  const connectingRef = useRef(false);

  useEffect(() => {
    if (!adapter) return;

    const handleConnect = (address: string) => {
      void address;
      const pk = adapter.publicKey;
      if (!pk) {
        setConnectError('Miden Wallet connected but did not provide a public key');
        return;
      }
      const { publicKeyHex, commitment } = PublicKeyFormat.parse(pk);
      // Miden Wallet keys are ECDSA; the length-based heuristic in PublicKeyFormat.parse
      // mislabels 32-byte keys as falcon, so force the scheme it actually uses.
      const scheme = 'ecdsa' as const;
      if (!commitment) {
        setConnectError(`Failed to derive commitment from ${scheme} public key (len=${pk.length})`);
        return;
      }
      // For a 32-byte key, PublicKeyFormat.parse takes its Falcon-commitment
      // branch and returns publicKeyHex === commitment, not a real secp256k1
      // point — passing that to MidenWalletSigner as an explicit key fails its
      // curve-point validation. Only trust publicKeyHex when the raw key is
      // actually EC-point-shaped; otherwise leave it null so the signer instead
      // recovers the real key from a produced signature.
      const isValidEcdsaPointLength = pk.length === 33 || pk.length === 65;
      setConnectError(null);
      setSession({
        source: 'miden-wallet',
        connected: true,
        publicKey: isValidEcdsaPointLength ? publicKeyHex : null,
        commitment,
        scheme,
      });
    };

    const handleDisconnect = () => {
      setConnectError(null);
      setSession((prev) => ({
        ...prev,
        connected: false,
        publicKey: null,
        commitment: null,
        scheme: null,
      }));
    };

    const handleError = (err: Error) => {
      setConnectError(err.message || err.name || 'Unknown wallet error');
    };

    adapter.on('connect', handleConnect);
    adapter.on('disconnect', handleDisconnect);
    adapter.on('error', handleError);

    if (adapter.connected && adapter.address) {
      handleConnect(adapter.address);
    }

    return () => {
      adapter.off('connect', handleConnect);
      adapter.off('disconnect', handleDisconnect);
      adapter.off('error', handleError);
    };
  }, [adapter]);

  const connect = useCallback(async () => {
    if (!adapter || connectingRef.current) return;
    connectingRef.current = true;
    try {
      await adapter.connect(PrivateDataPermission.UponRequest, walletNetwork());
    } finally {
      connectingRef.current = false;
    }
  }, [adapter]);

  const disconnect = useCallback(async () => {
    if (!adapter) return;
    // Reset the connecting guard so any hung connect() attempt doesn't
    // permanently block future reconnects.
    connectingRef.current = false;
    await adapter.disconnect();
  }, [adapter]);

  const signBytes = useCallback(
    async (data: Uint8Array, kind: 'word' | 'signingInputs'): Promise<Uint8Array> => {
      if (!adapter) throw new Error('Miden Wallet not connected');
      return adapter.signBytes(data, kind);
    },
    [adapter],
  );

  return { session, connect, disconnect, signBytes, connectError };
}
