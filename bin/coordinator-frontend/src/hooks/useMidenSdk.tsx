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

  useEffect(() => {
    loadSdk();
  }, [loadSdk]);

  return (
    <MidenSdkContext.Provider
      value={{ isLoading, Miden, createClient }}
    >
      {children}
    </MidenSdkContext.Provider>
  );
};
