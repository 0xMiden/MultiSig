import { useState, useEffect } from 'react';
import { MidenWebClientHandle } from '../../lib/miden-client';

export const useMidenClient = () => {
  const [demo, setDemo] = useState<MidenWebClientHandle | null>(null);
  const [status, setStatus] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeClient = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setStatus('Initializing Miden client...');
    setError(null);
    
    try {
      const newDemo = new MidenWebClientHandle();
      setDemo(newDemo);
      
      const success = await newDemo.initialize();
      if (success) {
        setStatus('Miden client initialized successfully!');
        setIsInitialized(true);
      } else {
        setStatus('Failed to initialize Miden client');
        setIsInitialized(false);
        setError('Initialization failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Error: ${errorMessage}`);
      setIsInitialized(false);
      setError(errorMessage);
      
      // Log detailed error for debugging
      console.error('Miden client initialization error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    initializeClient();
  }, []);

  return {
    demo,
    status,
    isRunning,
    isInitialized,
    error,
    initializeClient
  };
}; 