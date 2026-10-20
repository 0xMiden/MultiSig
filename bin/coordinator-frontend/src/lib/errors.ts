/**
 * An error whose message is written for the user: handlers show it as it is,
 * never reworded into a wallet or network error.
 */
export class UserFacingError extends Error {
  override name = 'UserFacingError';
}

export function formatError(err: unknown, prefix?: string): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Unknown error';
  return prefix ? `${prefix}: ${message}` : message;
}

export function classifyWalletError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  const lower = (msg + ' ' + name).toLowerCase();

  if (lower.includes('user cancelled') || lower.includes('user rejected') || lower.includes('user denied')) {
    return 'Signing was cancelled';
  }
  if (lower.includes('walletnotready') || lower.includes('not detected') || lower.includes('not found') || lower.includes('not installed')) {
    return 'Wallet extension not detected. Please install the Bread browser extension.';
  }
  if (lower.includes('not connected') || lower.includes('no wallet')) {
    return 'Wallet is not connected';
  }
  if (lower.includes('invalid signature') || lower.includes('signature format')) {
    return 'Invalid signature format';
  }
  return msg || name || 'Unknown wallet error';
}

/**
 * User-facing text for a failed execute or release. Known failure modes get a
 * plain explanation; anything else falls back to Guardian's user-safe message
 * or a trimmed first line. The raw error is logged for diagnostics.
 */
export function describeExecutionError(err: unknown, prefix: string): string {
  console.error(`${prefix}:`, err);
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('transaction expired')) {
    return `${prefix}: the transaction expired before it could be submitted. Proving took too long; try again.`;
  }
  if (lower.includes('failed to prove transaction') || lower.includes('bodystreambuffer was aborted')) {
    return `${prefix}: the transaction prover did not respond. Try again in a moment.`;
  }
  if (lower.includes('failed to submit proven transaction')) {
    return `${prefix}: the Miden node rejected the transaction. Sync and try again.`;
  }
  // The multisig client refuses, before anything is pushed, to execute a
  // proposal pinned to another account state than this client holds (its
  // message names two 64-hex commitments, which would push its advice past
  // the cut-off). The execute handler syncs the account first, so by the time
  // this is seen the account has moved past the proposal's state: another
  // transaction took its slot, and no retry can help.
  if (lower.includes('was made for account state')) {
    return `${prefix}: another transaction was executed first, so this proposal can no longer execute. Discard it and create it again if the change is still needed.`;
  }
  // Before the network check: "failed to fetch account snapshot" is a local
  // IndexedDB failure, not a network one.
  if (lower.includes('database-related') || lower.includes('prematurecommiterror')) {
    return `${prefix}: this browser's local Miden data could not be read. Reload the page and try again.`;
  }
  // The browser's own network failure ("TypeError: Failed to fetch" in
  // Chromium, "NetworkError when attempting to fetch resource" in Firefox),
  // not SDK messages such as "failed to fetch transaction inputs from the data
  // store", which are lower-case.
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError')) {
    return `${prefix}: could not reach the network. Check your connection and try again.`;
  }

  const userMessage = (err as { userMessage?: unknown } | null)?.userMessage;
  if (typeof userMessage === 'string' && userMessage.trim()) {
    return sentence(`${prefix}: ${userMessage.trim()}`);
  }
  const firstLine = raw.split('\n')[0].trim();
  return sentence(`${prefix}: ${firstLine.length > 200 ? `${firstLine.slice(0, 197)}…` : firstLine || 'Unknown error'}`);
}

function sentence(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}
