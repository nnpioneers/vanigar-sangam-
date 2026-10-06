/**
 * Core Domain Module Contracts
 *
 * Defines the standardized interface for domain modules in the Vanigar Sangam backend.
 * Every business module (Members, Daily Sheet, Collections, Loans, etc.) exposes an `AppModule`
 * definition that encapsulates its Express router and base path.
 */

import type { Router } from 'express';
import type { Queryable } from '../database/index.js';

/**
 * Standard definition contract for domain modules.
 */
export interface AppModule {
  /** Unique domain module name in lowercase snake_case (e.g. 'auth', 'members', 'loans') */
  readonly name: string;
  /** HTTP mount path for the module (e.g. '/api/v1/auth', '/api/v1/members') */
  readonly basePath: string;
  /** Express router containing all endpoints and route guards for the module */
  readonly router: Router;
}

/**
 * Execution context passed to service methods for cross-module coordination and atomic transactions.
 */
export interface ServiceContext {
  /** Optional active database transaction client. If omitted, the service uses the shared pool. */
  readonly tx?: Queryable;
  /** Optional ID of the administrator performing the action, for auditing */
  readonly adminId?: string;
  /** Optional correlation request ID for distributed tracing */
  readonly requestId?: string;
}
