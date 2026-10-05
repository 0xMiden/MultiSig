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

/** Deletes the web client's IndexedDB store, resolving even if the delete is blocked. */
function deleteMidenStore(): Promise<void> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.deleteDatabase(MIDEN_DB_NAME);
    } catch {
      resolve();
      return;
    }
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    // A blocked delete (another tab holds the DB open) still resolves so the
    // retry can surface the real, actionable error instead of hanging.
    request.onblocked = () => resolve();
  });
}

export async function createMidenClient(rpcUrl = MIDEN_RPC_URL): Promise<MidenClient> {
  // Note: do NOT sync here. Syncing before any note tags are registered
  // advances the cursor past the current tip, causing the client to miss
  // public notes minted before tag registration. Tags are added in
  // handleCreate/handleLoad/handleSync and the first sync happens there.
  const create = () =>
    MidenClient.create({
      rpcUrl,
      noteTransportUrl: MIDEN_NOTE_TRANSPORT_URL,
      proverUrl: MIDEN_PROVER_URL,
      storeName: MIDEN_DB_NAME,
    });

  let client: MidenClient;
  try {
    client = await create();
  } catch (firstError) {
    // The web client's IndexedDB store ("IdxdbStore") fails to open when the
    // database was written by a different web-SDK version — a stale schema from
    // earlier testing. The multisig's state is reconstructable from Guardian and
    // the node, so dropping the local store and rebuilding it is safe, and the
    // only recovery from a store that will not open. Retry exactly once.
    await deleteMidenStore();
    try {
      client = await create();
    } catch {
      // The wipe did not help. The usual remaining cause is another tab of this
      // app holding the database open (which also blocks the delete). Tell the
      // user what to do; keep the original error for context.
      const detail = firstError instanceof Error ? firstError.message : String(firstError);
      throw new Error(
        `Could not open the local database (${detail}). Close any other tabs of this app and reload; ` +
          `if it persists, clear this site's data in the browser.`,
      );
    }
  }
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
