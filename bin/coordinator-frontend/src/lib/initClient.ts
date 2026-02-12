import { WebClient, AuthSecretKey } from '@miden-sdk/miden-sdk';
import { MIDEN_DB_NAME, MIDEN_RPC_URL } from '@/config/psm';
import { normalizeCommitment } from '@/lib/helpers';
import type { SignerInfo } from '@/types/psm';

const SIGNER_DB_NAME = 'MultisigSignerKeys';
const SIGNER_STORE_NAME = 'keys';

export async function clearMidenDatabase(dbName = MIDEN_DB_NAME): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

function openSignerDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SIGNER_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SIGNER_STORE_NAME)) {
        db.createObjectStore(SIGNER_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSignerKeys(signer: SignerInfo): Promise<void> {
  const db = await openSignerDB();
  const tx = db.transaction(SIGNER_STORE_NAME, 'readwrite');
  const store = tx.objectStore(SIGNER_STORE_NAME);
  store.put(signer.falcon.secretKey.serialize(), 'falcon');
  store.put(signer.ecdsa.secretKey.serialize(), 'ecdsa');
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadSignerKeys(): Promise<SignerInfo | null> {
  try {
    const db = await openSignerDB();
    const tx = db.transaction(SIGNER_STORE_NAME, 'readonly');
    const store = tx.objectStore(SIGNER_STORE_NAME);

    const [falconBytes, ecdsaBytes] = await Promise.all([
      new Promise<Uint8Array | undefined>((resolve, reject) => {
        const req = store.get('falcon');
        req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
        req.onerror = () => reject(req.error);
      }),
      new Promise<Uint8Array | undefined>((resolve, reject) => {
        const req = store.get('ecdsa');
        req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
        req.onerror = () => reject(req.error);
      }),
    ]);

    db.close();

    if (!falconBytes || !ecdsaBytes) return null;

    const falconSecretKey = AuthSecretKey.deserialize(falconBytes);
    const ecdsaSecretKey = AuthSecretKey.deserialize(ecdsaBytes);
    const falconCommitment = normalizeCommitment(falconSecretKey.publicKey().toCommitment().toHex());
    const ecdsaCommitment = normalizeCommitment(ecdsaSecretKey.publicKey().toCommitment().toHex());

    return {
      falcon: { commitment: falconCommitment, secretKey: falconSecretKey },
      ecdsa: { commitment: ecdsaCommitment, secretKey: ecdsaSecretKey },
      activeScheme: 'falcon',
    };
  } catch {
    return null;
  }
}

export async function clearSignerKeys(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(SIGNER_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
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
  const falconCommitment = normalizeCommitment(falconSecretKey.publicKey().toCommitment().toHex());
  const ecdsaCommitment = normalizeCommitment(ecdsaSecretKey.publicKey().toCommitment().toHex());

  return {
    falcon: { commitment: falconCommitment, secretKey: falconSecretKey },
    ecdsa: { commitment: ecdsaCommitment, secretKey: ecdsaSecretKey },
    activeScheme: 'falcon',
  };
}
