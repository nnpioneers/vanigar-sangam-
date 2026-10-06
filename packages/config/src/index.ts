/**
 * `@vanigar/config`
 *
 * Purpose: Centralized, typed access helpers for reading and validating
 * application configuration from environment variables.
 *
 * No secrets or real credentials are ever stored or printed here.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type AppEnvironment = 'development' | 'production' | 'test';

export interface ConfigValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Loads a local `.env` file into `process.env` when present.
 * Searches from `process.cwd()` upwards to find `.env` in monorepo root.
 */
export function loadLocalEnv(file = '.env'): void {
  let currentDir = process.cwd();
  let targetPath = resolve(currentDir, file);

  while (!existsSync(targetPath)) {
    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
    targetPath = resolve(currentDir, file);
  }

  if (!existsSync(targetPath)) {
    return;
  }
  if (typeof process.loadEnvFile !== 'function') {
    throw new Error('process.loadEnvFile is unavailable — Node.js >= 20.12.0 is required.');
  }
  process.loadEnvFile(targetPath);
}

/** Returns the trimmed value of an environment variable, or `undefined` when unset/blank. */
export function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Returns the value of a required environment variable, throwing when it is missing. */
export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Returns an integer environment variable, or `fallback` when unset; throws when malformed. */
export function readIntEnv(name: string, fallback: number): number {
  const value = readEnv(name);
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid integer, received: ${value}`);
  }
  return parsed;
}

/** Returns a boolean environment variable ('true' | '1' | 'false' | '0'), or `fallback` when unset. */
export function readBoolEnv(name: string, fallback: boolean): boolean {
  const value = readEnv(name)?.toLowerCase();
  if (value === undefined) {
    return fallback;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  return fallback;
}

/** Returns the current application environment (`'development'` | `'production'` | `'test'`). */
export function getAppEnv(): AppEnvironment {
  const raw = readEnv('NODE_ENV')?.toLowerCase();
  if (raw === 'production' || raw === 'prod') {
    return 'production';
  }
  if (raw === 'test') {
    return 'test';
  }
  return 'development';
}

export function isProduction(): boolean {
  return getAppEnv() === 'production';
}

export function isDevelopment(): boolean {
  return getAppEnv() === 'development';
}

/**
 * Validates system environment variables safely without leaking secret values.
 * Reports missing variable NAMES and validation errors.
 */
export function validateEnvironment(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Server Port validation
  const portStr = readEnv('PORT');
  if (portStr !== undefined) {
    const portNum = Number.parseInt(portStr, 10);
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      errors.push(`PORT must be a valid integer between 1 and 65535.`);
    }
  }

  // 2. Database configuration validation
  const dbUrl = readEnv('DATABASE_URL');
  const dbHost = readEnv('DB_HOST');
  const dbName = readEnv('DB_NAME');
  const dbUser = readEnv('DB_USER');

  const hasDbUrl = Boolean(dbUrl);
  const hasDiscreteDb = Boolean(dbHost && dbName && dbUser);

  if (!hasDbUrl && !hasDiscreteDb) {
    errors.push('Database configuration missing: specify either DATABASE_URL or discrete DB_HOST, DB_NAME, DB_USER.');
  }

  // 3. Database Pool integer parameters
  for (const varName of ['DB_PORT', 'DB_POOL_MAX', 'DB_POOL_IDLE_TIMEOUT_MS', 'DB_POOL_CONN_TIMEOUT_MS']) {
    const val = readEnv(varName);
    if (val !== undefined) {
      const parsed = Number.parseInt(val, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        errors.push(`${varName} must be a positive integer.`);
      }
    }
  }

  // 4. Session secret check in production
  if (isProduction()) {
    const secret = readEnv('SESSION_SECRET');
    if (!secret || secret === 'replace-with-a-long-random-string') {
      warnings.push('SESSION_SECRET is using a placeholder value in production environment.');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
