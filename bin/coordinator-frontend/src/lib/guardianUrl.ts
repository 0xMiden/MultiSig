import { extraOrigins, originOf } from '@/lib/securityHeaders';

export interface GuardianUrlPolicy {
  /** The default Guardian plus NEXT_PUBLIC_GUARDIAN_ENDPOINTS. */
  guardians: readonly string[];
  /** NEXT_PUBLIC_CSP_CONNECT_SRC. */
  extra: string;
  /** The app's own origin ('self'). */
  self: string;
}

/**
 * Why the browser would refuse to reach a Guardian at `value`, or null if the
 * page's Content-Security-Policy (`connect-src`, built in securityHeaders.ts)
 * admits it. Checked before connecting so a blocked URL is explained instead
 * of failing as an opaque network error.
 */
export function guardianUrlProblem(value: string, policy: GuardianUrlPolicy): string | null {
  if (!value.trim()) return 'Enter a Guardian URL.';
  const origin = originOf(value);
  if (!origin) return 'Enter a full http(s) URL, e.g. https://guardian.example.com.';

  const guardians = policy.guardians.map(originOf).filter((o): o is string => o !== null);
  const allowed = new Set([policy.self, ...guardians, ...extraOrigins(policy.extra)]);
  if (allowed.has(origin)) return null;

  return `This app can only connect to the Guardians it was deployed with: ${guardians.join(', ') || 'none'}. ` +
    `To use ${origin}, add it to NEXT_PUBLIC_GUARDIAN_ENDPOINTS and redeploy.`;
}
