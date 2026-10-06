/**
 * Password Service
 *
 * Provides secure cryptographic hashing and verification using bcrypt (cost factor: 12).
 * Strictly isolated from HTTP/Express presentation layer.
 * Passwords and generated hashes are NEVER logged.
 */

import bcrypt from 'bcrypt';

/**
 * Recommended production salt rounds for bcrypt.
 * 12 rounds provides strong resistance against brute-force attacks while maintaining
 * acceptable latency (~200-300ms) on modern server hardware.
 */
export const BCRYPT_SALT_ROUNDS = 12;

/**
 * Maximum password byte length.
 * The standard bcrypt algorithm operates on a maximum of 72 bytes.
 * Restricting input to 72 bytes prevents silent truncation attacks.
 */
export const MAX_PASSWORD_BYTES = 72;

/**
 * Minimum password character length.
 */
export const MIN_PASSWORD_LENGTH = 8;

export class PasswordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordValidationError';
  }
}

/**
 * Validates a plaintext password string before cryptographic operations.
 * Throws a PasswordValidationError if invalid.
 */
export function validatePasswordInput(password: string): void {
  if (typeof password !== 'string' || password.length === 0) {
    throw new PasswordValidationError('Password must be a non-empty string.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordValidationError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    );
  }

  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength > MAX_PASSWORD_BYTES) {
    throw new PasswordValidationError(
      `Password exceeds maximum allowed length of ${MAX_PASSWORD_BYTES} bytes.`
    );
  }
}

/**
 * Cryptographically hashes a plaintext password using bcrypt with 12 salt rounds.
 *
 * @param password Plaintext password to hash
 * @returns Resolves to the bcrypt hash string ($2b$12$...)
 */
export async function hashPassword(password: string): Promise<string> {
  validatePasswordInput(password);
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 *
 * @param password Plaintext password to verify
 * @param passwordHash Stored bcrypt hash string
 * @returns Resolves to true if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  if (typeof password !== 'string' || password.length === 0) {
    return false;
  }

  if (typeof passwordHash !== 'string' || passwordHash.length === 0) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}
