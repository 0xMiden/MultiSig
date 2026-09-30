// Security headers for every response, including static assets. The
// Content-Security-Policy needs a per-request nonce, so src/middleware.ts sets it.
/** @param {boolean} production */
export function staticSecurityHeaders(production) {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // WebHID is needed for Ledger over USB; everything else stays off.
    { key: 'Permissions-Policy', value: 'hid=(self), camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    // Para's login opens popups that report back to this window.
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    ...(production
      ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
      : []),
  ];
}
