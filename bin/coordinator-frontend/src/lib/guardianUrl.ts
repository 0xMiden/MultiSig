import { extraOrigins, OPENZEPPELIN_GUARDIANS, originOf } from '@/lib/securityHeaders';

export interface GuardianUrlPolicy {
  /** The Guardian endpoint the app was built with (NEXT_PUBLIC_GUARDIAN_ENDPOINT). */
  configured: string;
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

  const allowed = new Set([policy.self, originOf(policy.configured), ...extraOrigins(policy.extra)]);
  if (allowed.has(origin)) return null;
  const url = new URL(origin);
  // `https://*.openzeppelin.com`: any subdomain, https, default port.
  const suffix = OPENZEPPELIN_GUARDIANS.slice('https://*'.length);
  if (url.protocol === 'https:' && url.port === '' && url.hostname.endsWith(suffix)) return null;

  const listed = [originOf(policy.configured), OPENZEPPELIN_GUARDIANS, ...extraOrigins(policy.extra)].filter(Boolean);
  return `This app's security policy only lets it connect to Guardians at ${listed.join(', ')}. ` +
    `To use ${origin}, add it to NEXT_PUBLIC_CSP_CONNECT_SRC and redeploy.`;
}
