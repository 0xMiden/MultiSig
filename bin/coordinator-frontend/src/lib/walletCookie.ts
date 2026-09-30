/**
 * The `currentWalletId` cookie lets the middleware route to the dashboard. It
 * holds only the account ID, never a secret, but it should not ride along on
 * cross-site subrequests or over plain http in production:
 * - `SameSite=Lax`: sent on top-level navigation (opening the app from a
 *   link), not on cross-site subrequests. `Strict` would bounce a signed-in user
 *   to login whenever they arrive from another site.
 * - `Secure` on https (not on http://localhost, where the browser would drop it).
 * `HttpOnly` cannot be set from the browser, and the client reads it anyway.
 */
export const WALLET_COOKIE = 'currentWalletId';
const ONE_YEAR_S = 31_536_000;

export function walletCookie(accountId: string, protocol: string): string {
  return `${WALLET_COOKIE}=${encodeURIComponent(accountId)}; path=/; max-age=${ONE_YEAR_S}; SameSite=Lax${protocol === 'https:' ? '; Secure' : ''}`;
}

export function expiredWalletCookie(protocol: string): string {
  return `${WALLET_COOKIE}=; path=/; max-age=0; SameSite=Lax${protocol === 'https:' ? '; Secure' : ''}`;
}

export function setWalletCookie(accountId: string): void {
  document.cookie = walletCookie(accountId, window.location.protocol);
}

export function clearWalletCookie(): void {
  document.cookie = expiredWalletCookie(window.location.protocol);
}
