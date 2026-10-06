# SECURE ADMINISTRATOR PROVISIONING SPECIFICATION

**Module:** Phase 2 — Authentication & User Management  
**Status:** Approved Specification  
**Date:** October 3, 2026  

---

## 1. Principles

1. **No Default Plaintext Passwords:** No hardcoded admin credentials (such as `admin`/`admin123`) shall ever be placed in migration files, seed scripts, source code, or repository documentation.
2. **Deterministic Security:** Every administrator account in the `admin_users` table must have a cryptographically secure password hash (using `argon2id` or `bcrypt` with appropriate salt rounds).
3. **No Migration Seeding of Credentials:** Database migrations must only define schema structure (`CREATE TABLE`), not credential data.

---

## 2. Secure First-Admin Provisioning Workflow

The initial `SUPER_ADMIN` account will be provisioned through a dedicated, interactive/environment-driven CLI provisioning script implemented in later tasks (e.g., `npm run admin:create`):

### Workflow:
1. **Interactive Prompt Mode:**
   - Prompts the operator for:
     - Full Name
     - Username (validated against format and uniqueness)
     - Password (securely masked input with complexity validation)
   - Generates password hash via backend hashing service.
   - Inserts record into `admin_users` with role `SUPER_ADMIN` and status `ACTIVE`.
   - Emits an immutable audit log entry.
2. **Automated/CI Environment Mode:**
   - Reads `INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_FULL_NAME`, and `INITIAL_ADMIN_PASSWORD` from environment variables.
   - Provisions account only if the `admin_users` table is completely empty (`SELECT COUNT(*) FROM admin_users` == 0).
   - Once provisioned, environment variables are cleared.

---

## 3. Subsequent Administrator Provisioning

All subsequent administrator accounts (`ADMIN`, `CASHIER`) must be created exclusively by an active `SUPER_ADMIN` through the secure authenticated administration API/UI, generating a secure one-time activation/reset flow.
