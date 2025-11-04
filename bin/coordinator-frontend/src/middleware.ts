import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

  // Redirect /dashboard to /dashboard/home
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/dashboard/home', request.url));
  }

  // Allow access in all other cases
  return NextResponse.next();
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
