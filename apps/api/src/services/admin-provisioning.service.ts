/**
 * Administrator Provisioning Service
 *
 * Implements secure administrator provisioning according to ADMIN_PROVISIONING_SPEC.md.
 * Ensures username uniqueness, role validation, secure hashing, and parameterized database access.
 * Passwords and hashes are NEVER returned or logged.
 */

import type { UserRole, AuthUser } from '@vanigar/shared-types';
import { getDbPool } from '../database/index.js';
import { hashPassword } from './password.service.js';

export interface ProvisionAdminParams {
  username: string;
  fullName: string;
  role: UserRole;
  password: string;
}

export class ProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProvisioningError';
  }
}

const VALID_ROLES: ReadonlySet<UserRole> = new Set(['SUPER_ADMIN', 'ADMIN', 'CASHIER']);

/**
 * Provisions a new administrator account securely.
 *
 * @param params Administrator provisioning credentials
 * @returns Safe AuthUser representation (strictly without password hash)
 */
export async function provisionAdmin(params: ProvisionAdminParams): Promise<AuthUser> {
  const username = params.username?.trim();
  const fullName = params.fullName?.trim();
  const role = params.role;
  const password = params.password;

  if (!username || username.length < 3 || username.length > 50) {
    throw new ProvisioningError('Username must be between 3 and 50 characters.');
  }

  // Alphanumeric + underscore/hyphen format validation
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw new ProvisioningError(
      'Username may only contain letters, numbers, underscores, and hyphens.'
    );
  }

  if (!fullName || fullName.length < 2 || fullName.length > 100) {
    throw new ProvisioningError('Full name must be between 2 and 100 characters.');
  }

  if (!VALID_ROLES.has(role)) {
    throw new ProvisioningError(`Invalid role specified: ${String(role)}. Must be SUPER_ADMIN, ADMIN, or CASHIER.`);
  }

  const pool = getDbPool();

  // 1. Check if username already exists
  const existingCheck = await pool.query(
    'SELECT id FROM admin_users WHERE username = $1',
    [username]
  );

  if (existingCheck.rows.length > 0) {
    throw new ProvisioningError(`Username "${username}" already exists. Provisioning aborted.`);
  }

  // 2. Hash password securely using bcrypt with 12 rounds
  const passwordHash = await hashPassword(password);

  // 3. Insert new admin record using parameterized SQL
  const insertResult = await pool.query<{
    id: string;
    username: string;
    full_name: string;
    role: UserRole;
    status: 'ACTIVE';
    created_at: Date;
  }>(
    `
    INSERT INTO admin_users (username, password_hash, full_name, role, status)
    VALUES ($1, $2, $3, $4, 'ACTIVE')
    RETURNING id, username, full_name, role, status, created_at
    `,
    [username, passwordHash, fullName, role]
  );

  const row = insertResult.rows[0];
  if (!row) {
    throw new ProvisioningError('Failed to retrieve inserted administrator record.');
  }

  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}
