export function normalizeCommitment(hex: string): string {
  const trimmed = hex.trim();
  if (!trimmed) throw new Error('Commitment is required');
  const withoutPrefix =
    trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed;
  if (!/^[0-9a-fA-F]{64}$/.test(withoutPrefix)) {
    throw new Error('Commitment must be a 64-character hex string');
  }
  return `0x${withoutPrefix.toLowerCase()}`;
}

export function copyToClipboard(text: string, onSuccess?: () => void): void {
  navigator.clipboard.writeText(text).then(() => {
    onSuccess?.();
  });
}

export async function clearIndexedDB(): Promise<void> {
  const databases = await indexedDB.databases();
  const deletePromises = databases
    .filter((db) => db.name)
    .map(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => resolve();
        })
    );
  await Promise.all(deletePromises);
}

export function truncateHex(hex: string, start = 16, end = 8): string {
  if (hex.length <= start + end) return hex;
  return `${hex.slice(0, start)}...${hex.slice(-end)}`;
}
