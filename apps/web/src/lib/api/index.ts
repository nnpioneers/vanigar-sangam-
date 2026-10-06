/**
 * Public surface of the web → API communication boundary.
 *
 * Import from `@/lib/api` rather than reaching into individual files.
 */
export { getApiBaseUrl } from './config';
export { apiRequest, ApiRequestError } from './client';
export type { ApiErrorEnvelope, ApiRequestOptions, ApiRequestErrorParams } from './client';
export { login, getCurrentUser, logout } from './auth';
export * from './members';
export * from './daily-sheets';
export * from './collections';
export * from './dashboard';
