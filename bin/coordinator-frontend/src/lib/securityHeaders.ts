// Content-Security-Policy for the signing app; the other security headers are in
// security-headers.mjs. Runs in the middleware (edge runtime): no Node or
// browser-only imports.

export interface CspConfig {
  nonce: string;
  dev: boolean;
  /** The default Guardian and every other one a user may switch to (NEXT_PUBLIC_GUARDIAN_ENDPOINTS). */
  guardianEndpoints: readonly string[];
  midenRpcUrl: string;
  noteTransportUrl: string;
  proverUrl: string;
  chatEndpoint: string;
  /** Para served from *.getpara.com (sandbox, beta, production) rather than its local dev stack. */
  paraHosted: boolean;
  /** Extra connect-src origins, space- or comma-separated (NEXT_PUBLIC_CSP_CONNECT_SRC). */
  extraConnectSrc: string;
}

/** Origin of an absolute http(s) URL, or null for shorthands and invalid input. */
export function originOf(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

export function extraOrigins(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map(originOf)
    .filter((origin): origin is string => origin !== null);
}

export function buildContentSecurityPolicy(config: CspConfig): string {
  const para = config.paraHosted
    ? ['https://*.getpara.com', 'wss://*.getpara.com', 'https://*.usecapsule.com']
    // Para's development environment talks to locally running Para services.
    : ['http://localhost:8080', 'http://localhost:3003', 'ws://localhost:3000'];
  const connectSrc = new Set<string>([
    "'self'",
    // Only the configured services: no wildcard for Miden or Guardian hosts.
    ...[...config.guardianEndpoints, config.midenRpcUrl, config.noteTransportUrl, config.proverUrl, config.chatEndpoint]
      .map(originOf)
      .filter((origin): origin is string => origin !== null),
    ...para,
    ...extraOrigins(config.extraConnectSrc),
  ]);
  if (config.dev) connectSrc.add('ws://localhost:*');

  const paraFrames = config.paraHosted
    ? ['https://*.getpara.com', 'https://*.usecapsule.com']
    : ['http://localhost:3003'];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Next.js attaches the nonce to its scripts; 'strict-dynamic' extends trust to
    // the chunks they load. WebAssembly compilation needs 'wasm-unsafe-eval', and
    // React's development build needs 'unsafe-eval'.
    'script-src': [
      "'self'",
      `'nonce-${config.nonce}'`,
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
      ...(config.dev ? ["'unsafe-eval'"] : []),
    ],
    // Inline style attributes (Tailwind arbitrary values, framer-motion) need this;
    // styles cannot run script.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [...connectSrc],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': paraFrames,
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ');
}
