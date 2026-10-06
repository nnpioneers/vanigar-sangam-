/**
 * Generic API request helper.
 *
 * Server- and client-safe: it only uses `fetch`, so it can be called from
 * Server Components and Client Components alike. It contains no
 * authentication, no session handling and no business endpoint calls.
 *
 * Response contract:
 * - success: the parsed JSON body is returned as `T`.
 * - 204 / empty body: `undefined` is returned as `T` (call with
 *   `apiRequest<void>` or check for `undefined`).
 * - failure: an `ApiRequestError` is thrown carrying status, machine-readable
 *   `code`, human-readable `message` and optional `details`, decoded from the
 *   API's `{ error: { code, message, details } }` envelope when present.
 * - transport failure: `ApiRequestError` with `status` 0 and code `NETWORK`.
 */

import type { ApiErrorResponse } from '@vanigar/shared-types';
import { getApiBaseUrl } from './config';
import { interceptApiRequest } from './mock-db';

/** Error envelope returned by the API for failed requests. */
export type ApiErrorEnvelope = ApiErrorResponse;

export interface ApiRequestErrorParams {
  message: string;
  status: number;
  code: string;
  details?: unknown;
  cause?: unknown;
}

/** Uniform error raised by the API request helper. */
export class ApiRequestError extends Error {
  /** HTTP status, or `0` when the request never reached the API. */
  readonly status: number;
  /** Machine-readable code (`NETWORK`, `INVALID_RESPONSE`, or the API's code). */
  readonly code: string;
  /** Optional structured detail supplied by the API. */
  readonly details?: unknown;

  constructor(params: ApiRequestErrorParams) {
    super(params.message, params.cause !== undefined ? { cause: params.cause } : undefined);
    this.name = 'ApiRequestError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'method' | 'headers'> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialised as JSON unless it is already a body-friendly value. */
  body?: unknown;
  /** Query parameters; `null` / `undefined` entries are omitted. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Absolute base URL override; defaults to the configured API base URL. */
  baseUrl?: string;
  headers?: HeadersInit;
}

/**
 * Resolves and formats a full API URL given a base URL, path, and optional query parameters.
 *
 * - Absolute base URLs (http:// or https://) are preserved directly.
 * - Relative browser base URLs (e.g. `/api/v1`) are resolved against `window.location.origin`
 *   when in the browser, or a local fallback when window is not defined.
 * - Path slashes are normalized cleanly.
 * - Query parameters are serialized safely.
 */
export function buildUrl(baseUrl: string, path: string, query?: ApiRequestOptions['query']): string {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  const fullPath = `${trimTrailingSlash(baseUrl)}${normalisedPath}`;
  const isAbsolute = /^https?:\/\//i.test(fullPath);

  const base = isAbsolute
    ? undefined
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost';

  const url = new URL(fullPath, base);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isPlainBody(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof Blob
  );
}

async function toRequestError(response: Response): Promise<ApiRequestError> {
  let code = 'HTTP_ERROR';
  let message = `Request failed with status ${response.status}`;
  let details: unknown;

  try {
    const text = await response.text();
    if (text !== '') {
      const parsed = JSON.parse(text) as Partial<ApiErrorEnvelope>;
      if (parsed.error && typeof parsed.error === 'object') {
        if (typeof parsed.error.code === 'string') {
          code = parsed.error.code;
        }
        if (typeof parsed.error.message === 'string') {
          message = parsed.error.message;
        }
        details = parsed.error.details;
      }
    }
  } catch {
    // Keep the generic fallback when the error body is not valid JSON.
  }

  return new ApiRequestError({ status: response.status, code, message, details });
}

/**
 * Performs a typed request against the API.
 *
 * @throws {ApiRequestError} on transport failure, non-2xx responses or an
 * unparseable success body.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const intercepted = interceptApiRequest(path, options);
  if (intercepted) {
    await new Promise(r => setTimeout(r, 400));
    return intercepted as T;
  }

  const { method = 'GET', body, query, baseUrl, headers, ...init } = options;

  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json');

  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (isPlainBody(body)) {
      payload = body;
    } else {
      payload = JSON.stringify(body);
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(baseUrl ?? getApiBaseUrl(), path, query), {
      credentials: 'include',
      ...init,
      method,
      headers: requestHeaders,
      body: payload,
    });
  } catch (cause) {
    throw new ApiRequestError({
      status: 0,
      code: 'NETWORK',
      message: 'Unable to reach the API.',
      cause,
    });
  }

  if (!response.ok) {
    throw await toRequestError(response);
  }

  const text = await response.text();
  if (text === '') {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new ApiRequestError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      message: 'The API returned a response that could not be parsed as JSON.',
      cause,
    });
  }
}
