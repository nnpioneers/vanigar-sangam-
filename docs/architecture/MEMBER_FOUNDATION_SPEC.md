# Phase 5.1 — Member Foundation Schema

## Overview
This document specifies the foundational schema and domain architecture for Association Members in the Vanigar Sangam application. This structure establishes member identities, relationships, and lifecycle status while acting as the core anchor for future financial features.

## 1. Member Identity
- **Member Number**: The `member_number` field is the primary business identity and main search key for an association member. It is explicitly required and uniquely constrained in the database. The system does not invent a generation format for member numbers, allowing the organization's existing business numbering scheme to persist seamlessly.
- **Internal Identifier**: A UUID (`id`) acts as the internal technical primary key for foreign-key relationships across the database.

## 2. Member Fields & Constraints
The `members` table incorporates the following verified data points:
- `id`: UUID (Primary Key)
- `member_number`: VARCHAR (UNIQUE, NOT NULL, indexed)
- `member_name`: VARCHAR (NOT NULL)
- `related_person_name`: VARCHAR (NOT NULL)
- `related_person_relationship`: VARCHAR (NOT NULL, strictly constrained to the relationship vocabulary)
- `shop_name`: VARCHAR (NULL)
- `address`: TEXT (NOT NULL)
- `mobile_number`: VARCHAR (NOT NULL)
- `number_of_sheets`: INTEGER (NOT NULL, MUST be > 0)
- `nominee_name`: VARCHAR (NULL)
- `nominee_relationship`: VARCHAR (NULL)
- `nominee_phone`: VARCHAR (NULL)
- `insurance_number`: VARCHAR (NULL)

## 3. Relationship Vocabulary
The `related_person_relationship` field implements a strict CHECK constraint against the confirmed vocabulary:
`'FATHER', 'MOTHER', 'HUSBAND', 'WIFE', 'SON', 'DAUGHTER', 'OTHER'`

## 4. Sheet Count Meaning
The `number_of_sheets` represents the structural multiplier for daily contributions (e.g., 1 sheet = ₹200/day, 2 sheets = ₹400/day). In this foundation phase, we merely store this positive integer count. The actual creation of daily sheets and related financial transactions are deliberately postponed to a future phase. 

## 5. Lifecycle & Historical Safety
- Members cannot be physically deleted from the database. A PostgreSQL trigger actively enforces immutability against `DELETE` operations.
- Instead, member lifecycles are managed through the `status` field (`ACTIVE` or `INACTIVE`).
- This design guarantees that historical records (e.g., future loans, cash collections, contributions) referencing a member will permanently retain their integrity even if the member becomes inactive.

## 6. Validation Rules
The service and database layers enforce:
- Required presence of `member_number`, `member_name`, `address`, and `mobile_number`.
- Strict positive values for `number_of_sheets`.
- Strict enum adherence for `related_person_relationship`.
- Hard uniqueness on `member_number` to prevent duplicate identities.

## 7. Future Module Relationships
The `members` foundation is positioned to be referenced by:
- Daily Sheets
- Contributions
- Loans and Guarantor relationships
- Collections and Cash Transactions
- Reporting and Audit modules

## 8. Intentionally Unimplemented Items
To strictly isolate concerns and avoid inventing unresolved policies, the following features are **NOT** implemented in Phase 5.1:
- Any form of Daily Sheet tracking or contribution collection.
- Savings balances, calculations, or related metrics.
- Loan workflows, eligibility formulas, or guarantor features.
- Dashboard or UI components for member management.
- Random or fake member seeding in the persistent development database.

**No random or demo members are seeded into the persistent development database.**

---

# Phase 5.3 — Member Profile & Read Model Hardening

## Overview
Phase 5.3 introduces a dedicated, read-only Member Profile API designed to securely expose verified member identity fields while strictly preserving historical integrity and preventing accidental data leakage or financial mutation.

> "Phase 5.3 Member Profile is a read-only member identity/profile layer and does not calculate or create financial, contribution, cash, loan, repayment, guarantor, or daily-sheet data."

## 1. Member Profile Endpoint
- **HTTP Method & Path**: `GET /api/v1/members/:memberNumber/profile`
- **Access Control**: Authenticated via existing session middleware (`requireAuth`). Unauthenticated requests are rejected with HTTP 401 (`UNAUTHENTICATED`).
- **Target Audience**: Backoffice administrative staff requiring member identity details.

## 2. Parameter Validation & Business Identity Lookup
- **Primary Business Identity**: The endpoint uses `member_number` as the sole business lookup key.
- **Structural Parameter Validation**:
  - `memberNumber` must be a non-empty string.
  - Whitespace-only values or parameters exceeding 50 characters are rejected with HTTP 400 (`INVALID_INPUT`).
- **Not Found Handling**: If no member exists for the given `member_number`, the endpoint returns a standardized HTTP 404 (`NOT_FOUND`) error envelope without leaking internal SQL queries, table names, or stack traces.

## 3. Explicit Column Selection & Data Isolation
- **Explicit Projection**: The repository executes an explicit `SELECT` statement naming only the required business fields. Wildcard `SELECT *` queries are strictly avoided to ensure internal database implementation details (such as the internal UUID `id` or unreleased schema constructs) are never leaked.
- **Response Fields**:
  - `memberNumber` (string)
  - `memberName` (string)
  - `relatedPersonName` (string)
  - `relatedPersonRelationship` ('FATHER' | 'MOTHER' | 'HUSBAND' | 'WIFE' | 'SON' | 'DAUGHTER' | 'OTHER')
  - `shopName` (string | null)
  - `address` (string)
  - `mobileNumber` (string)
  - `numberOfSheets` (number)
  - `nomineeName` (string | null)
  - `nomineeRelationship` (string | null)
  - `nomineePhone` (string | null)
  - `insuranceNumber` (string | null)
  - `status` ('ACTIVE' | 'INACTIVE')
  - `createdAt` (ISO-8601 string)
  - `updatedAt` (ISO-8601 string)
- **Sensitive Data Isolation**: The response envelope strictly guarantees no leakage of passwords, password hashes, admin accounts, session tokens, or other members' records.

## 4. Member Lifecycle & Status Behaviour
- **Both ACTIVE and INACTIVE members** are retrievable via this endpoint.
- Deactivating a member does not prevent profile access. Historical association identity must remain retrievable across all lifecycle states to support future historical auditing and ledger references.
- Inactive members return `"status": "INACTIVE"` with HTTP 200.

## 5. Explicitly Omitted Future Sections
In alignment with strict module boundaries, future business sections are **intentionally omitted** from the response payload rather than stubbed with fake arrays or empty mock records:
- Daily Sheet history
- Daily Contributions
- Collections
- Loans and Loan Repayments
- Outstanding Balances
- Guarantees Given and Received
- Cash Transactions
- Documents and Receipts

These sections will be integrated in their respective dedicated modules in subsequent phases.

## 6. Zero Financial & Database Side-Effects
The profile endpoint is strictly read-only:
- It creates **zero** financial transactions or ledger entries.
- It creates **zero** daily sheets or contribution records.
- It performs **no** financial calculations (no balance derivations, no arrears/advance math, no loan eligibility formulas).
- It does **not** update or mutate any member records (`updated_at` remains completely untouched).
- Repeated calls with identical parameters return deterministic, idempotent responses.

