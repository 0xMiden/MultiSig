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
