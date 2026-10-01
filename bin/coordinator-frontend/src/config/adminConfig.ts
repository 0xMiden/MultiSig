export interface AdminConfig { faucetId: string; feeFaucetId: string; networkId: string; }

/** Never throws at import — safe for the default wallet build. */
export function getAdminConfig(): AdminConfig {
  return {
    faucetId: process.env.NEXT_PUBLIC_USDCX_FAUCET_ID ?? '',
    feeFaucetId: process.env.NEXT_PUBLIC_USDCX_FEE_FAUCET_ID ?? '',
    networkId: process.env.NEXT_PUBLIC_MIDEN_NETWORK ?? 'devnet',
  };
}

/** Call at runtime use (admin mode only). Throws if misconfigured. */
export function assertAdminConfig(): AdminConfig {
  const c = getAdminConfig();
  if (!c.faucetId) throw new Error('NEXT_PUBLIC_USDCX_FAUCET_ID is not set');
  if (!c.feeFaucetId) throw new Error('NEXT_PUBLIC_USDCX_FEE_FAUCET_ID is not set');
  return c;
}
