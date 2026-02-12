'use client';

import React, { useState, useEffect } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ParaProvider, Environment } from '@getpara/react-sdk-lite';
import { Toaster } from 'sonner';

import { store } from '../store';
import { MultisigProvider, useMultisig } from '../contexts/MultisigContext';
import { AppHeader } from './AppHeader';
import { PARA_API_KEY, PARA_ENVIRONMENT } from '@/config/psm';

import '@getpara/react-sdk-lite/styles.css';

const queryClient = new QueryClient();
const paraEnv = PARA_ENVIRONMENT === 'production' ? Environment.PROD : Environment.DEV;

function ParaModalWrapper() {
  const { paraModalOpen, closeParaModal } = useMultisig();

  const [ParaModal, setParaModal] = useState<React.ComponentType<{ isOpen: boolean; onClose: () => void }> | null>(null);

  useEffect(() => {
    if (paraModalOpen && !ParaModal) {
      import('@getpara/react-sdk-lite').then((mod) => {
        setParaModal(() => mod.ParaModal);
      }).catch(() => {});
    }
  }, [paraModalOpen, ParaModal]);

  if (!ParaModal) return null;
  return <ParaModal isOpen={paraModalOpen} onClose={closeParaModal} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Always wrap with ParaProvider so useParaMiden hook has its context.
  // When no API key is set, Para features simply won't work but the provider won't crash.
  return (
    <QueryClientProvider client={queryClient}>
      <ParaProvider
        paraClientConfig={{ apiKey: PARA_API_KEY || 'placeholder', env: paraEnv }}
        config={{ appName: 'Miden Multisig' }}
      >
        <Provider store={store}>
          <MultisigProvider>
            <AppHeader />
            {children}
            {PARA_API_KEY && <ParaModalWrapper />}
            <Toaster position="bottom-right" />
          </MultisigProvider>
        </Provider>
      </ParaProvider>
    </QueryClientProvider>
  );
}
