import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  GUARDIAN_ENDPOINT,
  MIDEN_NOTE_TRANSPORT_URL,
  MIDEN_PROVER_URL,
  MIDEN_RPC_URL,
  PARA_ENVIRONMENT,
} from '@/config/psm';
import { buildContentSecurityPolicy } from '@/lib/securityHeaders';
import { paraIsHosted } from '@/lib/paraEnvironment';

// Pages get a per-request nonce so Next.js can mark its own inline scripts as
// trusted; everything else inline is refused.
function withContentSecurityPolicy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const policy = buildContentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV === 'development',
    guardianEndpoint: GUARDIAN_ENDPOINT,
    midenRpcUrl: MIDEN_RPC_URL,
    noteTransportUrl: MIDEN_NOTE_TRANSPORT_URL,
    proverUrl: MIDEN_PROVER_URL,
    chatEndpoint: process.env.NEXT_PUBLIC_CHAT_ENDPOINT ?? '',
    paraHosted: paraIsHosted(PARA_ENVIRONMENT),
    extraConnectSrc: process.env.NEXT_PUBLIC_CSP_CONNECT_SRC ?? '',
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get account ID from cookies (since middleware can't access localStorage directly)
  const accountId = request.cookies.get('currentWalletId')?.value;

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/login/createNewAccount', '/login/loadExistingAccount'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // If user has NO account ID and is not on a public route, redirect to login page
  if (!accountId && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user HAS account ID and is on a public route, redirect to dashboard home
  if (accountId && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard/home', request.url));
  }

  // Redirect / to /dashboard/home
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard/home', request.url));
  }
  
  // Redirect /dashboard to /dashboard/home
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/dashboard/home', request.url));
  }

  // Allow access in all other cases
  return withContentSecurityPolicy(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
