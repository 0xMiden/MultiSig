import { useState, useEffect, useCallback } from 'react';
import { useMidenSdk } from './useMidenSdk';
import { useMidenClient } from './useMidenClient';
import { AccountId, NetworkId, AccountInterface } from '@demox-labs/miden-sdk';
import { FungibleAsset } from '@/types';

export const useFungibleAssets = () => {
  const { Miden } = useMidenSdk();
  const { demo, isInitialized } = useMidenClient();
  const [fungibleAssets, setFungibleAssets] = useState<FungibleAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getFungibleAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const currentWalletId = localStorage.getItem("currentWalletId");
      if (!currentWalletId || !Miden || !demo || !isInitialized) {
        setIsLoading(false);
        return;
      }

      const webClient = demo.getWebClient();
      if (!webClient) {
        setIsLoading(false);
        return;
      }

      const address = Miden.Address.fromBech32(currentWalletId);
      const accountId = address.accountId();

      // Sync state before getting/importing account
      await webClient.syncState();

      let account = await webClient.getAccount(accountId);
      if (!account) {
        await webClient.importAccountById(accountId);
        account = await webClient.getAccount(accountId);
      }

      if (account) {
        const assetVault = account.vault();
        const assets = assetVault.fungibleAssets();

        const assetsWithBalance = assets.map(asset => {
          const faucetId = asset.faucetId().toBech32(NetworkId.Testnet, AccountInterface.Unspecified);
          const balance = assetVault.getBalance(asset.faucetId()).toString();
          return { faucetId, balance };
        });

        setFungibleAssets(assetsWithBalance);
      }
    } catch (error) {
      console.error('Error getting fungible assets:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch fungible assets');
    } finally {
      setIsLoading(false);
    }
  }, [Miden, demo, isInitialized]);

  // Load fungible assets on component mount
  useEffect(() => {
    getFungibleAssets();
  }, [getFungibleAssets]);

  return {
    fungibleAssets,
    isLoading,
    error,
    getFungibleAssets
  };
};
