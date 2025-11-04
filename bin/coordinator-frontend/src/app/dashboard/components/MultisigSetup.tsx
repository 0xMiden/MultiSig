'use client';

import { useState } from 'react';
import { MidenDemo } from '../../../../lib/miden-client';
import { SecretKey } from '@demox-labs/miden-sdk';

interface MultisigSetupProps {
  midenDemo: MidenDemo | null;
}

interface MultisigSetupResult {
  accountId?: string;
  status?: string;
  [key: string]: unknown;
}

export default function MultisigSetup({ midenDemo }: MultisigSetupProps) {
  const [publicKeys, setPublicKeys] = useState<string[]>(['', '', '']);
  const [threshold, setThreshold] = useState<number>(2);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MultisigSetupResult | null>(null);
  const [error, setError] = useState<string | null>('');

  const addPublicKey = () => {
    setPublicKeys([...publicKeys, '']);
  };

  const removePublicKey = (index: number) => {
    if (publicKeys.length > 1) {
      const newKeys = publicKeys.filter((_, i) => i !== index);
      setPublicKeys(newKeys);
    }
  };

  const updatePublicKey = (index: number, value: string) => {
    const newKeys = [...publicKeys];
    newKeys[index] = value;
    setPublicKeys(newKeys);
  };

  const generateRandomPublicKey = (index: number) => {
    try {
      const secretKey = SecretKey.withRng();
      const publicKey = secretKey.publicKey();
      const serializedBytes = publicKey.serialize();
      const publicKeyString = Array.from(serializedBytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      updatePublicKey(index, publicKeyString);
      setError('');
    } catch (err) {
      console.error('Error generating random public key:', err);
      setError('Failed to generate random public key. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!midenDemo) {
      setError('Miden client not initialized');
      return;
    }

    // Filter out empty public keys
    const validPublicKeys = publicKeys.filter(key => key.trim() !== '');
    
    if (validPublicKeys.length === 0) {
      setError('Please provide at least one public key');
      return;
    }

    if (threshold > validPublicKeys.length) {
      setError('Threshold cannot be greater than the number of public keys');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const webClient = midenDemo.getWebClient();
      if (!webClient) {
        throw new Error('Web client not available');
      }

       const publicKeyObjects = validPublicKeys.map(keyString => {
         try {
           const secretKey = SecretKey.withRng();
           return secretKey.publicKey();
         } catch (_err) {
           throw new Error(`Invalid public key format: ${keyString}`);
         }
       });


      const setupResult = webClient.setupAccount(publicKeyObjects, threshold);
      
      setResult(setupResult);
    } catch (err) {
      console.error('Error setting up multisig account:', err);
      setError(err instanceof Error ? err.message : 'Failed to setup multisig account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Multisig Account Setup</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Public Keys Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Public Keys ({publicKeys.length})
          </label>
          <div className="space-y-3">
            {publicKeys.map((key, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={key}
                  onChange={(e) => updatePublicKey(index, e.target.value)}
                  placeholder={`Public Key ${index + 1}`}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => generateRandomPublicKey(index)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Random
                </button>
                {publicKeys.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePublicKey(index)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPublicKey}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add Public Key
          </button>
        </div>

        {/* Threshold Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Threshold (minimum signatures required)
          </label>
          <input
            type="number"
            min="1"
            max={publicKeys.length}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Must be between 1 and {publicKeys.length}
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating Multisig Account...' : 'Create Multisig Account'}
        </button>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <strong>Error:</strong> {String(error)}
        </div>
      )}

      {/* Success Result */}
      {result && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
          <strong>Success!</strong> Multisig account created successfully.
          <pre className="mt-2 text-sm bg-white p-2 rounded border overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
