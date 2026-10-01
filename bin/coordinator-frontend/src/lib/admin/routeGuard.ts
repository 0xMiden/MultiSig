// Pure, node-testable routing guard for the admin/wallet build split. The
// `admin` build packages the admin mask; the `wallet` build packages the
// end-user wallet. This function decides, for a given dashboard pathname and
// the build's app mode, whether the request must be redirected away from a
// surface that isn't part of that build — enforced here so the gate lives at
// the route level, not just in what links/nav items happen to be hidden.
//
// Kept free of Next.js types (NextRequest, etc.) so it can be unit tested
// under plain Node/vitest without spinning up the edge runtime, and reused
// identically from `src/middleware.ts` and from page-level defense-in-depth
// redirects.

// End-user wallet surfaces that must not be reachable in an admin build.
const ADMIN_MODE_BLOCKED_PATHS = new Set([
  '/dashboard',
  '/dashboard/home',
  '/dashboard/assets',
]);

// The admin surface (and anything nested under it) must not be reachable in
// a wallet build — this also keeps the wallet build from ever mounting the
// admin page's faucet-role hooks.
const ADMIN_ROUTE_PREFIX = '/dashboard/admin';

export function adminRouteGuard(
  pathname: string,
  adminMode: boolean
): { redirectTo: string } | null {
  if (adminMode) {
    if (ADMIN_MODE_BLOCKED_PATHS.has(pathname)) {
      return { redirectTo: '/dashboard/admin' };
    }
    return null;
  }

  // Wallet mode: block the admin route and everything nested under it.
  if (pathname === ADMIN_ROUTE_PREFIX || pathname.startsWith(`${ADMIN_ROUTE_PREFIX}/`)) {
    return { redirectTo: '/dashboard/home' };
  }

  return null;
}
