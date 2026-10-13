import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSignerKeys } from '../../src/lib/initClient';

// A failed read must never look like "no keys yet": start-up would then
// generate new keys and overwrite the stored ones, losing that signer.
function fakeIndexedDb(stored: Record<string, Uint8Array | undefined> | 'open-fails') {
  return {
    open: () => {
      const request: Record<string, unknown> = {};
      queueMicrotask(() => {
        if (stored === 'open-fails') {
          request.error = new Error('UnknownError: Internal error opening backing store');
          (request.onerror as () => void)();
          return;
        }
        request.result = {
          objectStoreNames: { contains: () => true },
          close: () => {},
          transaction: () => ({
            objectStore: () => ({
              get: (key: string) => {
                const get: Record<string, unknown> = {};
                queueMicrotask(() => { get.result = stored[key]; (get.onsuccess as () => void)(); });
                return get;
              },
            }),
          }),
        };
        (request.onsuccess as () => void)();
      });
      return request;
    },
  };
}

describe('loadSignerKeys', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns null only when no keys are stored', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDb({}));
    await expect(loadSignerKeys()).resolves.toBeNull();
  });

  it('throws on a read failure instead of reporting "no keys"', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDb('open-fails'));
    await expect(loadSignerKeys()).rejects.toThrow(/could not be read, so none were replaced/);
  });

  it('throws when only one of the two keys is stored', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDb({ falcon: new Uint8Array([1, 2, 3]) }));
    await expect(loadSignerKeys()).rejects.toThrow(/Only one of the two local signer keys/);
  });

  it('throws on keys that cannot be decoded', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDb({ falcon: new Uint8Array([1]), ecdsa: new Uint8Array([2]) }));
    await expect(loadSignerKeys()).rejects.toThrow(/could not be decoded, so none were replaced/);
  });
});
