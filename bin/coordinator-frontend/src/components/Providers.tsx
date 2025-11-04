'use client';

import { Provider } from 'react-redux';
import { store } from '../store';
import { useState, useEffect } from 'react';
import {
  WalletProvider,
  WalletModalProvider,
  MidenWalletAdapter,
  PrivateDataPermission,
} from '@demox-labs/miden-wallet-adapter';
import { MidenSdkProvider } from '../hooks/useMidenSdk';

// Import styles
import '@demox-labs/miden-wallet-adapter/styles.css';

export function Providers({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<MidenWalletAdapter[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const midenAdapter = new MidenWalletAdapter({
      appName: 'Miden Wallet App',
    });

    setWallets([midenAdapter]);
  }, []);

  // Render basic providers during SSR, full wallet providers only on client
  if (!mounted) {
    return (
      <Provider store={store}>
        <MidenSdkProvider>
          {children}
        </MidenSdkProvider>
      </Provider>
    );
  }

  return (
    <Provider store={store}>
      <WalletProvider
        wallets={wallets}
        privateDataPermission={PrivateDataPermission.UponRequest}
        autoConnect={true}
      >
        <WalletModalProvider>
          <MidenSdkProvider>
            {children}
          </MidenSdkProvider>
        </WalletModalProvider>
      </WalletProvider>
    </Provider>
  );
}