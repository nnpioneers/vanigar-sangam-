# VANIGAR SANGAM — AUTHENTICATION ARCHITECTURE SPECIFICATION

**Module:** Phase 2 — Authentication & User Management  
**Status:** Architecture Frozen & Contracts Established  
**Date:** October 3, 2026  

---

## 1. Overview & Security Principles

The **Vanigar Sangam** system implements a secure **Server-Side Session Authentication** model with **HTTP-only Cookies** and **Role-Based Access Control (RBAC)**.

### Core Security Rules:
1. **No Client-Side Token Storage:** Authentication tokens or session secrets must **NEVER** be stored in `localStorage`, `sessionStorage`, or JavaScript-accessible variables.
2. **HTTP-only Cookies:** Session IDs are transmitted exclusively via HTTP-only, `SameSite=Lax` cookies. In production environments (`NODE_ENV=production`), the `Secure` flag is enforced.
3. **No Password Exposure:** Password hashes must **NEVER** be returned to the frontend or included in API response payloads (`AuthUser` DTO strictly excludes password fields).
4. **No Plaintext Passwords:** Passwords must be securely hashed on the backend using `argon2` or `bcrypt` with appropriate salt rounds.
5. **No Secret Leakage:** Passwords, session IDs, and secret keys must never be written to logs, console output, or error messages.
6. **Generic Login Errors:** Login failures return a generic `INVALID_CREDENTIALS` error code without revealing whether a username exists in the system.

---

## 2. Authentication Lifecycle & Flow

```text
[ LOGIN FLOW ]
Client Application (Web)
   │
   ├─► POST /api/v1/auth/login { username, password }
   │
REST API (apps/api)
   ├─► 1. Extract & validate structural request body (Zod)
   ├─► 2. Lookup user by username in `admin_users`
   ├─► 3. Verify user status is 'ACTIVE' (reject if INACTIVE or SUSPENDED)
   ├─► 4. Verify password hash using secure hashing algorithm
   ├─► 5. Generate secure random session ID
   ├─► 6. Store session record in PostgreSQL `sessions` table
   ├─► 7. Set HTTP-only session cookie (`vs_session=...; HttpOnly; SameSite=Lax`)
   └─► 8. Return ApiSuccessResponse<AuthSessionResponse> { user, sessionExpiresAt }

[ AUTHENTICATED REQUEST FLOW ]
Client Application (Web)
   │
   ├─► Request with Cookie header (`vs_session=...`)
   │
REST API (apps/api)
   ├─► 1. `sessionMiddleware`: Read cookie -> query PostgreSQL `sessions` table
   ├─► 2. Verify session is not expired (`expires_at > NOW()`)
   ├─► 3. Attach authenticated user context to Express request (`req.user`)
   ├─► 4. `permissionMiddleware`: Verify user role against endpoint permissions
   └─► 5. Controller handles business request

[ LOGOUT FLOW ]
Client Application (Web)
   │
   ├─► POST /api/v1/auth/logout
   │
REST API (apps/api)
   ├─► 1. Delete session record from PostgreSQL `sessions` table
   ├─► 2. Clear HTTP-only session cookie (`Max-Age=0`)
   └─► 3. Return ApiSuccessResponse<LogoutResponse> { success: true }
```

---

## 3. Server-Side Session Model (PostgreSQL Schema Planned for Task 2.2)

Session data is stored in PostgreSQL to ensure immediate server-side revocation, administrative session termination, and complete session auditing.

```sql
-- Planned PostgreSQL table schema for Task 2.2
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(128) PRIMARY KEY,                  -- Secure random session token / hash
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45) NULL,                   -- IPv4 or IPv6 client address
  user_agent TEXT NULL,                          -- Browser / client user agent
  expires_at TIMESTAMPTZ NOT NULL,               -- Absolute session expiration time
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Session creation timestamp
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- Last request timestamp
);

CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
```

---

## 4. Role Boundaries & Access Control (RBAC)

The system defines 3 administrative roles:

| Role | Hierarchy | Access Scope |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Level 3 (Highest) | Full administrative access: manage admin accounts, global system settings, audit logs, financial overrides, full module access. |
| **`ADMIN`** | Level 2 | Standard association business operations: member registration, sheet management, loan approvals, daily sheets, reports. |
| **`CASHIER`** | Level 1 | Restricted daily operational tasks: save daily collection entries, record loan repayments, manage physical cash holdings. |

### Account Lifecycle Statuses:
- **`ACTIVE`**: User can authenticate and perform authorized operations.
- **`INACTIVE`**: Account is disabled by an administrator; login attempts fail with `ACCOUNT_INACTIVE`.
- **`SUSPENDED`**: Account is temporarily locked due to security policy or investigation; login attempts fail with `ACCOUNT_SUSPENDED`.

---

## 5. API Endpoint Contracts

All authentication endpoints return standardized JSON envelopes (`ApiSuccessResponse<T>` or `ApiErrorResponse`).

### 5.1 POST `/api/v1/auth/login`
- **Description:** Authenticate administrator credentials and create a server-side session.
- **Request Body:**
  ```json
  {
    "username": "admin_user",
    "password": "SecretPassword123!"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "data": {
      "user": {
        "id": "c7a8b4e2-9f1d-4e8a-b3c2-1a9f8e7d6c5b",
        "username": "admin_user",
        "fullName": "Association Administrator",
        "role": "ADMIN",
        "status": "ACTIVE",
        "createdAt": "2026-10-03T12:00:00.000Z"
      },
      "sessionExpiresAt": "2026-10-04T12:00:00.000Z"
    },
    "error": null
  }
  ```
- **Cookie Header Set:** `vs_session=<session_id>; Path=/; HttpOnly; SameSite=Lax`

### 5.2 GET `/api/v1/auth/me`
- **Description:** Retrieve currently authenticated user context from session cookie.
- **Success Response (200 OK):**
  ```json
  {
    "data": {
      "user": {
        "id": "c7a8b4e2-9f1d-4e8a-b3c2-1a9f8e7d6c5b",
        "username": "admin_user",
        "fullName": "Association Administrator",
        "role": "ADMIN",
        "status": "ACTIVE",
        "createdAt": "2026-10-03T12:00:00.000Z"
      }
    },
    "error": null
  }
  ```

### 5.3 POST `/api/v1/auth/logout`
- **Description:** Invalidate active server session and clear session cookie.
- **Success Response (200 OK):**
  ```json
  {
    "data": {
      "success": true
    },
    "error": null
  }
  ```

---

## 6. Authentication Error Codes

| Error Code | HTTP Status | Trigger Condition |
| :--- | :--- | :--- |
| `INVALID_CREDENTIALS` | `401 Unauthorized` | Username not found or password verification failed |
| `UNAUTHENTICATED` | `401 Unauthorized` | Missing or invalid session cookie on protected route |
| `FORBIDDEN` | `403 Forbidden` | Authenticated user lacks required role/permission |
| `ACCOUNT_INACTIVE` | `403 Forbidden` | Account status is set to `INACTIVE` |
| `ACCOUNT_SUSPENDED` | `403 Forbidden` | Account status is set to `SUSPENDED` |
| `SESSION_EXPIRED` | `401 Unauthorized` | Session timestamp has exceeded absolute expiration |

---

## 7. Express Middleware Architecture Pattern

In Express (`apps/api`), authentication context flows through a explicit middleware pipeline:

```text
Request
  │
  ▼
[express.json() & loadLocalEnv()]
  │
  ▼
[sessionMiddleware] ───────────────► Resolves cookie, queries DB, attaches `req.user`
  │
  ▼
[requireAuthGuard] ────────────────► Rejects with `UNAUTHENTICATED` if `req.user` missing
  │
  ▼
[requireRoleGuard('ADMIN')] ───────► Rejects with `FORBIDDEN` if role insufficient
  │
  ▼
[Route Controller]
```

---

**END OF AUTHENTICATION ARCHITECTURE SPECIFICATION**
