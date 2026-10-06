# VANIGAR SANGAM — DATABASE MIGRATION & SCHEMA SPECIFICATION

**Version:** 1.0.0  
**Phase:** Phase 3.5 — Database Migration & Schema Foundation Hardening  
**Status:** Approved Architectural Standard  

---

## 1. Overview & Core Principles

This specification defines the mandatory conventions, invariants, and operational workflows for PostgreSQL schema design and database migration execution within the **Vanigar Sangam** system.

### Core Principles:
1. **Deterministic Sequential Ordering:** Every schema change is introduced via an immutable `.sql` migration file with a strict 3-digit zero-padded prefix (`NNN_description.sql`).
2. **Atomic Execution:** PostgreSQL transactional DDL guarantees that each migration file executes within an isolated `BEGIN ... COMMIT` block. Any failure triggers immediate `ROLLBACK`, leaving zero partial schema states.
3. **Immutability of Applied Migrations:** Once applied to any environment, migration files are permanently immutable. The system computes and stores normalized SHA-256 cryptographic checksums in `schema_migrations` to detect and block drift.
4. **Zero Floating-Point Financials:** Monetary amounts are stored strictly as exact 64-bit integers (`BIGINT`) representing **paise** (1 Rupee = 100 paise). The types `FLOAT`, `DOUBLE PRECISION`, and `REAL` are strictly prohibited.
5. **Standardized Identifiers & Timezones:** All identifiers use lowercase `snake_case`. All timestamps use `TIMESTAMPTZ` (`timestamp with time zone`) in UTC. Business dates without time components use `DATE`.

---

## 2. Migration Lifecycle & Execution Workflow

```
[ Developer / CI / Production Operator ]
                     │
                     ▼
           npm run db:migrate
                     │
                     ▼
┌──────────────────────────────────────────────┐
│        Migration Discovery & Lock            │
│   - Reads database/migrations/*.sql          │
│   - Acquires advisory lock / connection      │
│   - Queries schema_migrations history        │
└────────────────────┬─────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────┐
│       Integrity & Immutability Check         │
│   - Computes SHA-256 for all applied files   │
│   - Compares with DB recorded checksums      │
└────────────────────┬─────────────────────────┘
                     │
            [Checksum Mismatch?]
            ├──────────────► ABORT: Migration integrity violation
            │                "Applied migration has been modified on disk"
            ▼ [All Match]
┌──────────────────────────────────────────────┐
│          Sequential Pending Filter           │
│   - Identifies unapplied files in order      │
│   - Validates NNN prefix sequence (no gaps)  │
└────────────────────┬─────────────────────────┘
                     │
                     ▼
        [Loop Each Pending Migration]
                     │
                     ├──► 1. BEGIN Transaction
                     ├──► 2. Execute SQL file content
                     ├──► 3. Measure execution time
                     ├──► 4. Calculate SHA-256 checksum
                     ├──► 5. INSERT INTO schema_migrations
                     ├──► 6. COMMIT Transaction
                     │
             [Any SQL Failure?]
             └─────────────► ROLLBACK Transaction
                             Emit error and terminate
                             No subsequent migrations run
```

---

## 3. Migration File Conventions

### 3.1 File Naming & Numbering
- **Format:** `NNN_short_description.sql`
- **Prefix:** Exactly 3 digits, zero-padded (`001`, `002`, `003`, ..., `999`).
- **Description:** Lowercase alphanumeric and underscores (`[a-z0-9_]+`).
- **Sequencing:** Strictly incremental without gaps. Migration `003` must follow `002`; sequence gaps or duplicate prefixes are rejected by `validateMigrationFiles()`.

### 3.2 Immutability & Checksums
- Each migration file's content is hashed using SHA-256 with newline normalization (`\r\n` -> `\n`) to ensure cross-platform consistency between Windows and Linux.
- Checksums are stored in `schema_migrations.checksum`.
- If an already-applied file on disk is edited, subsequent runs of `npm run db:migrate` and `validateMigrationFiles()` will fail immediately to protect against unnoticed drift.
- **Rule:** Schema corrections or additions must **always** be introduced as a new sequential migration file, never by modifying an existing applied migration.

---

## 4. Schema Naming & Data Type Conventions

### 4.1 Identifiers
- All table names, column names, constraint names, and index names must use lowercase `snake_case`.
- Tables are named using plural nouns where appropriate (e.g., `admin_users`, `sessions`, `members`).

### 4.2 Primary Keys
- Entity primary keys use UUIDs generated via PostgreSQL's native `gen_random_uuid()`:
  ```sql
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
  ```
- Purely internal append-only technical tables (like `schema_migrations`) may use `SERIAL` or `BIGSERIAL`.

### 4.3 Timestamps & Business Dates
- **Timestamps:** Must strictly use `TIMESTAMPTZ` (`timestamp with time zone`). Stored and read in UTC:
  ```sql
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ```
- **Business Dates:** Calendar-only dates (such as sheet dates, collection dates, birth dates) without time zones must use `DATE`:
  ```sql
  entry_date DATE NOT NULL
  ```

---

## 5. Financial Data Safety Standard

To guarantee 100% mathematical precision and eliminate IEEE 754 floating-point drift:

1. **Storage Unit:** All monetary amounts (shares, loans, interest, penalties, cash holdings, daily collections) must be stored as **integer paise** using `BIGINT`:
   - ₹ 1,500.50 is stored as `150050`
   - ₹ 0.75 is stored as `75`
2. **Column Naming:** Financial columns must explicitly convey their unit in the column name (e.g., `amount_paise`, `balance_paise`, `principal_paise`, `interest_paise`).
3. **Application Math:** Application code must use the safe integer math utilities in [`@vanigar/api/src/database/money.ts`](file:///c:/Users/Acer/OneDrive/Desktop/NNP@4%20maji/Web%20file/vanigar%20sangam%20for%20antigravity/apps/api/src/database/money.ts) (`BigInt` math: `safeAddPaise`, `safeSubtractPaise`, `rupeesToPaise`, `paiseToRupees`).
4. **Prohibited Types:** `FLOAT`, `DOUBLE PRECISION`, `REAL`, and unsized `NUMERIC` are strictly forbidden for monetary storage.

---

## 6. Constraints, Foreign Keys & Indexes

### 6.1 Foreign Key Delete Behaviors
- **Deliberate Intent:** Every foreign key must explicitly define its `ON DELETE` behavior.
- **Financial & Audit Safety:** Cascade deletions are **strictly forbidden** on financial transaction records, ledger entries, loan schedules, and audit logs. They must use `ON DELETE RESTRICT` or `ON DELETE NO ACTION`.
- **Ephemeral State:** Cascade deletion (`ON DELETE CASCADE`) is permitted only on tightly coupled, ephemeral child entities (e.g. deleting an admin account cascades to delete active browser `sessions`).

### 6.2 Indexing Expectations
- All foreign key columns (`REFERENCES ...`) must have an explicit accompanying index:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_<table_name>_<column_name> ON <table_name>(<column_name>);
  ```
- Status and timestamp columns used for range filtering or lifecycle queries must be indexed intentionally based on query patterns.

---

## 7. Prohibited Patterns

| Prohibited Pattern | Reason | Required Alternative |
| :--- | :--- | :--- |
| `FLOAT`, `DOUBLE PRECISION`, `REAL` | IEEE 754 floating-point rounding errors cause financial drift | `BIGINT` (integer paise) |
| `TIMESTAMP` (without time zone) | Ambiguous timezone conversions and server timezone dependencies | `TIMESTAMPTZ` (UTC) |
| Modifying applied `.sql` migrations | Causes silent schema drift across environments | Add a new incremental migration |
| Non-sequential migration numbering | Non-deterministic ordering across branches and deployments | Strictly sequential `NNN_` prefix |
| `ON DELETE CASCADE` on financial records | Accidental parent deletion destroys ledger history | `ON DELETE RESTRICT` |
| Unindexed Foreign Keys | Causes full table scans on parent lookups and foreign key checks | `CREATE INDEX idx_...` on FK column |
| Hardcoded credentials in migrations | Security vulnerability and credential leakage | Interactive CLI or environment variables |

---

## 8. CLI Tooling & Verification

The project provides dedicated npm commands for migration management:

- `npm run db:migrate` — Executes all pending migrations in deterministic order.
- `npm run db:migrate:status` — Displays applied vs pending status, execution timestamps, and checksum validity.
- `npm run test:migration` — Runs the migration hardening test suite verifying sequence ordering, DDL rollback, float prevention, and checksum verification.
- `npm run test:conventions` — Verifies PostgreSQL catalog conventions (UUID PKs, TIMESTAMPTZ, indexes, constraints, exact paise math).
