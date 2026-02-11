import { WebClient, AuthSecretKey } from '@miden-sdk/miden-sdk';
import { MIDEN_DB_NAME, MIDEN_RPC_URL } from '@/config/psm';
import type { SignerInfo } from '@/types/psm';

export async function clearMidenDatabase(dbName = MIDEN_DB_NAME): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

export async function createWebClient(rpcUrl = MIDEN_RPC_URL): Promise<WebClient> {
  const client = await WebClient.createClient(rpcUrl);
  await client.syncState();
  return client;
}

export function initializeSigner(): SignerInfo {
  const falconSecretKey = AuthSecretKey.rpoFalconWithRNG(undefined);
  const ecdsaSecretKey = AuthSecretKey.ecdsaWithRNG(undefined);
  const falconCommitment = falconSecretKey.publicKey().toCommitment().toHex();
  const ecdsaCommitment = ecdsaSecretKey.publicKey().toCommitment().toHex();

  return {
    falcon: { commitment: falconCommitment, secretKey: falconSecretKey },
    ecdsa: { commitment: ecdsaCommitment, secretKey: ecdsaSecretKey },
    activeScheme: 'falcon',
  };
}
