/**
 * Pure route protection and redirection evaluation logic.
 *
 * Designed to be shared safely between Next.js Edge Middleware and unit test harnesses.
 * Operates purely on URL pathnames and session presence indicators.
 */

export const SESSION_COOKIE_NAME = 'vs_session';

/**
 * Route prefixes that require an active authenticated session.
 */
export const PROTECTED_ROUTES = ['/dashboard', '/members', '/daily-sheets', '/collections', '/loans'] as const;

/**
 * Route prefixes reserved for unauthenticated users (e.g. login).
 * Authenticated users accessing these will be redirected to the dashboard.
 */
export const AUTH_ROUTES = ['/login'] as const;

/**
 * Checks if a given pathname belongs to the protected route hierarchy.
 */
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Checks if a given pathname is an authentication route (e.g. /login).
 */
export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Evaluates whether an incoming request needs redirection based on session state.
 *
 * @param pathname The request pathname (e.g. '/dashboard', '/login', '/')
 * @param hasSession Whether the HTTP-only `vs_session` cookie is present
 * @returns The destination path string if redirection is required, or null if the request may proceed.
 */
export function resolveAuthRedirect(pathname: string, hasSession: boolean): string | null {
  // Normalize pathname to strip trailing slashes (except root '/')
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  // Root route '/'
  if (normalized === '/') {
    return hasSession ? '/dashboard' : '/login';
  }

  // Protected routes: redirect to /login if unauthenticated
  if (isProtectedRoute(normalized)) {
    if (!hasSession) {
      return `/login?from=${encodeURIComponent(normalized)}`;
    }
    return null;
  }

  // Auth routes (e.g. /login): redirect to /dashboard if already authenticated
  if (isAuthRoute(normalized)) {
    if (hasSession) {
      return '/dashboard';
    }
    return null;
  }

  // Any other public / non-gated routes proceed normally
  return null;
}
