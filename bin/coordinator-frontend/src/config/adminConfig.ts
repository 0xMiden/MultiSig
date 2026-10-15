import { AGGLAYER_PROFILE, USDCX_PROFILE, type AdminTarget, type AdminTargetKind } from '@/lib/admin/target';

export interface AdminConfig {
  faucetId: string;
  bridgeId: string;
  feeFaucetId: string;
  networkId: string;
}

/** Never throws at import — safe for the default wallet build. */
export function getAdminConfig(): AdminConfig {
  return {
    faucetId: process.env.NEXT_PUBLIC_USDCX_FAUCET_ID ?? '',
    bridgeId: process.env.NEXT_PUBLIC_AGGLAYER_BRIDGE_ID ?? '',
    feeFaucetId: process.env.NEXT_PUBLIC_USDCX_FEE_FAUCET_ID ?? '',
    networkId: process.env.NEXT_PUBLIC_MIDEN_NETWORK ?? 'devnet',
  };
}

/**
 * The contracts this build can administer, in display order. A target is present only when its
 * contract id is configured; with the bridge id unset the console is USDCx-only, exactly as before.
 */
export function getAdminTargets(): AdminTarget[] {
  const cfg = getAdminConfig();
  const targets: AdminTarget[] = [];
  if (cfg.faucetId) targets.push({ ...USDCX_PROFILE, contractId: cfg.faucetId, feeFaucetId: cfg.feeFaucetId, networkId: cfg.networkId });
  if (cfg.bridgeId) targets.push({ ...AGGLAYER_PROFILE, contractId: cfg.bridgeId, feeFaucetId: cfg.feeFaucetId, networkId: cfg.networkId });
  return targets;
}

export function targetOfKind(kind: AdminTargetKind): AdminTarget | null {
  return getAdminTargets().find((t) => t.kind === kind) ?? null;
}
