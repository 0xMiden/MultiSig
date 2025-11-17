import {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { MidenSdkContextState, MidenSdkProviderProps } from '@/types';

// Type-only import to avoid loading WASM during build
type MidenSdkType = typeof import('@demox-labs/miden-sdk');

const defaultContext: {
  isLoading: boolean;
  Miden: MidenSdkType | null;
} = {
  isLoading: true,
  Miden: null,
};

export const MidenSdkContext = createContext<MidenSdkContextState>(
  defaultContext as MidenSdkContextState
);

export const useMidenSdk = (): MidenSdkContextState => {
  return useContext(MidenSdkContext);
};

export const MidenSdkProvider: FC<MidenSdkProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [Miden, setMiden] = useState<MidenSdkType | null>(null);

  const loadSdk = useCallback(async () => {
    if (!isLoading && Miden !== null) return;
    const sdk: typeof import('@demox-labs/miden-sdk') = await import(
      '@demox-labs/miden-sdk'
    );
    setIsLoading(false);
    setMiden(sdk);
  }, [isLoading, Miden, setIsLoading, setMiden]);

  const createClient = useCallback(async () => {
    if (!Miden) return null;
    return await Miden.WebClient.createClient('https://rpc.testnet.miden.io');
  }, [Miden]);

  const createFaucet = useCallback(
    async (
      client: unknown,
      storageMode: unknown,
      nonFungible: boolean,
      assetSymbol: string,
      decimals: number,
      totalSupply: bigint
    ): Promise<unknown> => {
      if (!Miden || !client)
        throw new Error('Miden SDK or client not initialized');

      try {
        // Cast client to any to use dynamic SDK methods
        const webClient = client as any;
        
        // First sync the client state to ensure we're up to date
        await webClient.syncState();

        // Create the faucet with provided configuration
        const faucet = await webClient.newFaucet(
          storageMode,
          nonFungible,
          assetSymbol,
          decimals,
          totalSupply
        );

        // Get the faucet ID before any other operations
        const newFaucetId = faucet.id();

        // Add a delay to ensure proper initialization
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Sync state again after faucet creation
        await webClient.syncState();

        return newFaucetId;
      } catch (error) {
        console.error('Error creating faucet:', error);
        throw error;
      }
    },
    [Miden]
  );

  useEffect(() => {
    loadSdk();
  }, [loadSdk]);

  return (
    <MidenSdkContext.Provider
      value={{ isLoading, Miden, createClient, createFaucet }}
    >
      {children}
    </MidenSdkContext.Provider>
  );
};
