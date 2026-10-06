/**
 * API base-URL configuration for the web → API boundary.
 *
 * The web application is presentation-only: it never imports database,
 * ORM, repository or business-rule code. All backend access goes through
 * the REST API using the helpers in this folder.
 *
 * Endpoint-specific clients (members, loans, cash, …) do NOT belong here;
 * they are introduced together with the module that owns them.
 */

/** Planned REST namespace (see the approved API architecture). */
const DEFAULT_API_BASE_URL = 'http://localhost:4000/api/v1';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Resolves the API base URL.
 *
 * `NEXT_PUBLIC_API_URL` is the only override and is deliberately a
 * `NEXT_PUBLIC_` variable so it is safe to expose in the browser.
 * Server-only secrets must never be read from this module.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL?.trim() || '/api/v1';
  }

  const fromEnv =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL?.trim() : undefined;

  return fromEnv ? trimTrailingSlash(fromEnv) : DEFAULT_API_BASE_URL;
}
