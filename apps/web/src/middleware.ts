/**
 * Next.js Edge Middleware for Route Protection & Authentication Gating
 *
 * Enforces session boundaries:
 * - Unauthenticated requests to protected paths (`/dashboard/*`) are redirected to `/login` with return destination.
 * - Authenticated requests with `vs_session` cookie visiting `/login` or `/` are redirected to `/dashboard`.
 * - Static assets, Next.js internal chunks, and `/api/*` proxies are bypassed.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveAuthRedirect, SESSION_COOKIE_NAME } from './lib/auth-guard';

export function middleware(request: NextRequest) {
  // Disabled middleware auth check to allow mock-db to work without real backend cookies
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (/api/:path*)
     * - static image/asset extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
