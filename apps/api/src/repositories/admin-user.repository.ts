/**
 * Admin User Repository
 *
 * Encapsulates all database operations for the `admin_users` table.
 * Adheres strictly to the architectural boundary:
 * - Direct SQL data access using parameterized queries
 * - Completely decoupled from HTTP / Express layers
 * - Accepts optional `Queryable` executor to participate in transactions
 */

import type { UserRole, UserStatus } from '@vanigar/shared-types';
import type { Queryable } from '../database/index.js';
import { BaseRepository } from './base.repository.js';

export interface AdminUserRecord {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface AdminUserRow {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export class AdminUserRepository extends BaseRepository {
  private mapRow(row: AdminUserRow): AdminUserRecord {
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Finds an admin user by UUID.
   */
  async findById(id: string, executor?: Queryable): Promise<AdminUserRecord | null> {
    const queryText = `
      SELECT id, username, password_hash, full_name, role, status, created_at, updated_at
      FROM admin_users
      WHERE id = $1;
    `;
    const row = await this.queryOne<AdminUserRow>(queryText, [id], executor);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Finds an admin user by unique username.
   */
  async findByUsername(username: string, executor?: Queryable): Promise<AdminUserRecord | null> {
    const queryText = `
      SELECT id, username, password_hash, full_name, role, status, created_at, updated_at
      FROM admin_users
      WHERE username = $1;
    `;
    const row = await this.queryOne<AdminUserRow>(queryText, [username], executor);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Checks if an admin user exists with the given username.
   */
  async existsByUsername(username: string, executor?: Queryable): Promise<boolean> {
    const queryText = `
      SELECT 1 FROM admin_users WHERE username = $1 LIMIT 1;
    `;
    return this.exists(queryText, [username], executor);
  }

  /**
   * Updates an admin user's status within an optional transaction.
   */
  async updateStatus(id: string, status: UserStatus, executor?: Queryable): Promise<boolean> {
    const queryText = `
      UPDATE admin_users
      SET status = $1, updated_at = NOW()
      WHERE id = $2;
    `;
    const affected = await this.execute(queryText, [status, id], executor);
    return affected > 0;
  }
}
