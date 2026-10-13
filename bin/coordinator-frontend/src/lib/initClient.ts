import { MidenClient, AuthSecretKey } from '@miden-sdk/miden-sdk';
import { MIDEN_DB_NAME, MIDEN_RPC_URL, MIDEN_NOTE_TRANSPORT_URL, MIDEN_PROVER_URL } from '@/config/psm';
import { normalizeCommitment } from '@/lib/helpers';
import type { SignerInfo } from '@/types/psm';
import { instrumentPublicClient } from './midenDiagnostics';

const SIGNER_DB_NAME = 'MultisigSignerKeys';
const SIGNER_STORE_NAME = 'keys';

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

/**
 * The local signer keys, or null when none are stored yet (the caller then
 * generates them). Any read or decode failure, or only one of the two keys
 * present, throws instead: returning null there would make start-up generate
 * new keys and overwrite the stored ones, losing that signer.
 */
export async function loadSignerKeys(): Promise<SignerInfo | null> {
  let falconBytes: Uint8Array | undefined;
  let ecdsaBytes: Uint8Array | undefined;
  try {
    const db = await openSignerDB();
    try {
      const tx = db.transaction(SIGNER_STORE_NAME, 'readonly');
      const store = tx.objectStore(SIGNER_STORE_NAME);
      const read = (key: string) => new Promise<Uint8Array | undefined>((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
        req.onerror = () => reject(req.error);
      });
      [falconBytes, ecdsaBytes] = await Promise.all([read('falcon'), read('ecdsa')]);
    } finally {
      db.close();
    }
  } catch (err) {
    throw new Error(`The local signer keys could not be read, so none were replaced: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!falconBytes && !ecdsaBytes) return null;
  if (!falconBytes || !ecdsaBytes) {
    throw new Error('Only one of the two local signer keys is stored, so none were replaced. Clear this site\'s data to start with new keys.');
  }
  try {
    const falconSecretKey = AuthSecretKey.deserialize(falconBytes);
    const ecdsaSecretKey = AuthSecretKey.deserialize(ecdsaBytes);
    const falconCommitment = normalizeCommitment(falconSecretKey.publicKey().toCommitment().toHex());
    const ecdsaCommitment = normalizeCommitment(ecdsaSecretKey.publicKey().toCommitment().toHex());
    return {
      falcon: { commitment: falconCommitment, secretKey: falconSecretKey },
      ecdsa: { commitment: ecdsaCommitment, secretKey: ecdsaSecretKey },
      activeScheme: 'falcon',
    };
  } catch (err) {
    throw new Error(`The local signer keys could not be decoded, so none were replaced: ${err instanceof Error ? err.message : String(err)}`);
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

export async function createMidenClient(rpcUrl = MIDEN_RPC_URL): Promise<MidenClient> {
  // Note: do NOT sync here. Syncing before any note tags are registered
  // advances the cursor past the current tip, causing the client to miss
  // public notes minted before tag registration. Tags are added in
  // handleCreate/handleLoad/handleSync and the first sync happens there.
  const client = await MidenClient.create({
    rpcUrl,
    noteTransportUrl: MIDEN_NOTE_TRANSPORT_URL,
    proverUrl: MIDEN_PROVER_URL,
    storeName: MIDEN_DB_NAME,
  });
  instrumentPublicClient(client);
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
