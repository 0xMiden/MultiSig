import { GUARDIAN_ENDPOINTS } from '@/config/psm';
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

/** guardianUrlProblem against this deployment's allowed Guardians. */
export function deployedGuardianUrlProblem(value: string): string | null {
  return guardianUrlProblem(value, {
    guardians: GUARDIAN_ENDPOINTS,
    extra: process.env.NEXT_PUBLIC_CSP_CONNECT_SRC ?? '',
    self: typeof window === 'undefined' ? '' : window.location.origin,
  });
}

/**
 * Why this app cannot act on a proposal that switches to another Guardian, or
 * null: executing it contacts the new Guardian, which the page's CSP may
 * block (a cosigner using another client can propose any endpoint).
 */
export function switchGuardianProblem(proposal: { metadata?: { proposalType?: string; newGuardianEndpoint?: string } }): string | null {
  const md = proposal.metadata;
  if (md?.proposalType !== 'switch_guardian') return null;
  if (!md.newGuardianEndpoint) return 'This proposal does not name the new Guardian endpoint.';
  const problem = deployedGuardianUrlProblem(md.newGuardianEndpoint);
  return problem && `This proposal switches to ${md.newGuardianEndpoint}, which this app cannot reach. ${problem}`;
}
