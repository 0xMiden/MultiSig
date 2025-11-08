'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MidenWebClientHandle } from '../../lib/miden-client';

interface MidenClientContextType {
  handle: MidenWebClientHandle | null;
  status: string;
  isRunning: boolean;
  isInitialized: boolean;
  error: string | null;
  reinitialize: () => Promise<void>;
}

const MidenClientContext = createContext<MidenClientContextType | undefined>(undefined);

export function MidenClientProvider({ children }: { children: ReactNode }) {
  const [handle, setHandle] = useState<MidenWebClientHandle | null>(null);
  const [status, setStatus] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reinitialize = async () => {
    if (isRunning || isInitialized) {
      console.log('MidenClient: Already running or initialized, skipping');
      return;
    }

    console.log('MidenClient: Starting initialization...');
    setIsRunning(true);
    setStatus('Initializing Miden client...');
    setError(null);
    
    try {
      const newHandle = new MidenWebClientHandle();
      setHandle(newHandle);
      
      const success = await newHandle.initialize();
      if (success) {
        console.log('MidenClient: Initialized successfully!');
        setStatus('Miden client initialized successfully!');
        setIsInitialized(true);
      } else {
        console.error('MidenClient: Initialization failed');
        setStatus('Failed to initialize Miden client');
        setIsInitialized(false);
        setError('Initialization failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('MidenClient: Initialization error:', err);
      setStatus(`Error: ${errorMessage}`);
      setIsInitialized(false);
      setError(errorMessage);
    } finally {
      setIsRunning(false);
    }
  };

  // Initialize once on mount
  useEffect(() => {
    reinitialize();
  }, []);

  return (
    <MidenClientContext.Provider
      value={{
        handle,
        status,
        isRunning,
        isInitialized,
        error,
        reinitialize,
      }}
    >
      {children}
    </MidenClientContext.Provider>
  );
}

export function useMidenClient() {
  const context = useContext(MidenClientContext);
  if (context === undefined) {
    throw new Error('useMidenClient must be used within a MidenClientProvider');
  }
  return context;
}
