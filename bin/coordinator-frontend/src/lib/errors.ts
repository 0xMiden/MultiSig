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
    return 'Wallet extension not detected. Please install the Miden Wallet browser extension.';
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
  // Before the network check: "failed to fetch account snapshot" is a local
  // IndexedDB failure, not a network one.
  if (lower.includes('database-related') || lower.includes('prematurecommiterror')) {
    return `${prefix}: this browser's local Miden data could not be read. Reload the page and try again.`;
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
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
