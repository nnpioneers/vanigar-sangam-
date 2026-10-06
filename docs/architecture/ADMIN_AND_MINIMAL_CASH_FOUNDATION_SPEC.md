# VANIGAR SANGAM — ADMIN & MINIMAL CASH FOUNDATION SPECIFICATION

**Version:** 1.0.0  
**Phase:** Phase 4.1 — Admin & Minimal Cash Foundation Schema (M14a)  
**Status:** Approved Architectural Standard  

---

## 1. Executive Summary & Purpose

The **Vanigar Sangam** association financial system operates on a strict **ledger-first, append-only architecture**. Association administrators, staff, and field collectors physically collect cash from members and hand it over to the treasury or senior administrators.

Phase 4.1 establishes the foundational data structures and domain interfaces required to:
1. Track physical cash holding accounts tied directly to existing authenticated administrator identities (`admin_users`).
2. Record every cash movement into an append-only financial ledger (`cash_transactions`).
3. Compute authoritative cash balances dynamically using mathematical derivation, guaranteeing zero floating-point drift and eliminating mutable balance corruption.
4. Prepare the cross-module linkage foundation for upcoming modules (Members, Daily Sheet, Collections, Loans, and Audit Logs).

> [!IMPORTANT]
> This is **M14a — Minimal Cash Foundation**. It does **NOT** implement cash transfer workflows, peer-to-peer reconciliation, loan disbursements, or daily collection sheet tables.

---

## 2. Admin Cash Account Architecture

### 2.1 Identity Binding
Physical cash in the association is held by designated individuals. Rather than creating a redundant staff or employee table, cash accounts directly reference the existing `admin_users` table:

```sql
CREATE TABLE admin_cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL UNIQUE REFERENCES admin_users(id) ON DELETE RESTRICT,
  account_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.2 Invariants & Rules
1. **One Account Per Holder:** The `UNIQUE (admin_id)` constraint ensures that an administrator has exactly one primary cash holding account.
2. **Foreign Key Integrity (`ON DELETE RESTRICT`):** An administrator who holds or has held cash cannot be silently deleted from the system. Attempting to drop an administrator record with linked cash history violates `ON DELETE RESTRICT` (PostgreSQL error code `23001`).
3. **No Authoritative Balance Column:** The `admin_cash_accounts` table intentionally **omits** a `current_balance` column. Storing a mutable balance invites race conditions, concurrent update lost-writes, and auditing drift.

---

## 3. Cash Ledger Architecture

### 3.1 Append-Only Table (`cash_transactions`)
Every financial movement affecting an administrator's physical cash holding is stored as an immutable row:

```sql
CREATE TABLE cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES admin_cash_accounts(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
    'OPENING_BALANCE',
    'COLLECTION_DEPOSIT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'LOAN_DISBURSEMENT',
    'EXPENSE',
    'ADJUSTMENT'
  )),
  domain_entity_type VARCHAR(50) NULL,
  domain_entity_id UUID NULL,
  correlation_id VARCHAR(100) NULL,
  notes TEXT NULL,
  recorded_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  transacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.2 Monetary Precision: Exact Integer Paise
In accordance with the financial architecture established in Phase 0 and Phase 3.2:
- All monetary amounts are stored as 64-bit integers (`BIGINT`) representing **paise** (1 Rupee = 100 paise).
- `amount_paise` has a strict database CHECK constraint (`amount_paise > 0`).
- Floating-point types (`FLOAT`, `DOUBLE PRECISION`, `REAL`) are strictly prohibited across all tables.

### 3.3 Transaction Direction
- **`CREDIT`:** Inflow of physical cash into the holder's custody (+).  
  *Examples:* Daily sheet collection deposit, cash received from another admin, opening float.
- **`DEBIT`:** Outflow of physical cash from the holder's custody (-).  
  *Examples:* Cash handed over to treasury, physical cash disbursed to a borrower, approved association expense.

---

## 4. Derived Cash Balance Formula

The authoritative balance is derived on demand from the transaction ledger:

$$\text{Balance} = \sum(\text{CREDIT entries}) - \sum(\text{DEBIT entries})$$

### 4.1 SQL View: `v_admin_cash_balances`
PostgreSQL calculates the balance dynamically across the ledger entries:

```sql
CREATE OR REPLACE VIEW v_admin_cash_balances AS
SELECT 
  a.id AS account_id,
  a.admin_id,
  a.account_name,
  a.status,
  COALESCE(SUM(CASE WHEN t.direction = 'CREDIT' THEN t.amount_paise ELSE 0 END), 0)::BIGINT AS total_credit_paise,
  COALESCE(SUM(CASE WHEN t.direction = 'DEBIT' THEN t.amount_paise ELSE 0 END), 0)::BIGINT AS total_debit_paise,
  (
    COALESCE(SUM(CASE WHEN t.direction = 'CREDIT' THEN t.amount_paise ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.direction = 'DEBIT' THEN t.amount_paise ELSE 0 END), 0)
  )::BIGINT AS balance_paise,
  COUNT(t.id)::INTEGER AS transaction_count,
  MAX(t.transacted_at) AS last_transacted_at
FROM admin_cash_accounts a
LEFT JOIN cash_transactions t ON a.id = t.account_id
GROUP BY a.id, a.admin_id, a.account_name, a.status;
```

---

## 5. Append-Only Immutability Protection

Financial integrity requires that once written, a cash ledger transaction cannot be altered or removed. This is enforced at the database engine level via a row trigger:

```sql
CREATE OR REPLACE FUNCTION prevent_cash_transactions_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'cash_transactions is an append-only ledger: UPDATE and DELETE operations are strictly prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_cash_transactions_update_delete
BEFORE UPDATE OR DELETE ON cash_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_cash_transactions_modification();
```

Any attempt to run `UPDATE cash_transactions ...` or `DELETE FROM cash_transactions ...` raises an uncatchable database exception. Correcting errors must be performed via offsetting ledger entries (`ADJUSTMENT`).

---

## 6. Transaction Identity & Cross-Module Linkage

### 6.1 Future Contribution-to-Cash Atomicity
When the Daily Sheet & Member Collections module is implemented in subsequent phases, recording a daily installment must create both the domain record and the cash record inside the same transaction:

```text
BEGIN TRANSACTION;
  1. INSERT INTO daily_collections (id, daily_sheet_id, member_id, actual_paid_amount, ...)
     -> Returns: collection_id
  2. INSERT INTO cash_transactions (
       account_id,
       amount_paise,
       direction = 'CREDIT',
       transaction_type = 'COLLECTION_DEPOSIT',
       domain_entity_type = 'DAILY_COLLECTION',
       domain_entity_id = collection_id,
       correlation_id = req.id,
       recorded_by_admin_id = admin.id
     );
COMMIT;
```

If either insertion fails, the entire transaction is rolled back, guaranteeing that cash on hand and daily collection totals are never out of balance.

### 6.2 Future Three-Legged Atomicity
Every business event involving physical cash must coordinate three operations within a single database transaction:

```
┌────────────────────────────────────────────────────────┐
│                   Database Transaction                 │
│                                                        │
│  1. Domain Record (e.g. Loan Disbursement / Sheet)     │
│       ▲                                                │
│       │ (Atomic Coordination)                          │
│       ▼                                                │
│  2. Cash Ledger Record (Append-only CREDIT/DEBIT)      │
│       ▲                                                │
│       │ (Atomic Coordination)                          │
│       ▼                                                │
│  3. Audit Log Record (Immutable event trace)           │
└────────────────────────────────────────────────────────┘
```

The `correlation_id` column on `cash_transactions` maps to the distributed `request_id` or operation ID, allowing complete cross-table auditing.

---

## 7. What Is Intentionally NOT Implemented Yet

To preserve architectural boundaries and prevent scope creep:
1. **No Transfer Workflows:** Handing cash between two admins (`cash_transfers`) is deferred to Phase 4.2.
2. **No Reconciliation Workflows:** Daily end-of-day physical cash verification vs. ledger balance is deferred.
3. **No Loan Disbursement / Collection Operations:** Business module operations await their respective phases.
4. **No Member or Daily Sheet Tables:** No business tables exist in this phase.
5. **No Cash Management UI:** Frontend cash management screens will be built only when the corresponding backend services are complete.

---

## 8. Unresolved Cash Policies (Preserved for Future Stakeholder Decision)

The following real-world policy questions are intentionally preserved as pending and have **not** been assumed:
1. **Negative Balance Policy:** Can an administrator's physical cash balance temporarily go negative during rapid disbursements before collections are entered, or must negative balances be hard-rejected at the service level?
2. **Cash Transfer Acceptance:** Does an admin-to-admin cash transfer take effect immediately, or does it require an explicit two-step protocol (Transferor sends $\to$ Transferee confirms receipt)?
3. **Daily Cash Holding Limits:** Is there a maximum ceiling of physical cash that an administrator or cashier may hold overnight before requiring a mandatory bank deposit or handover to the treasurer?
4. **Discrepancy Write-offs:** What approval role (`SUPER_ADMIN` vs `ADMIN`) is required to authorize an `ADJUSTMENT` transaction for physical cash loss or counting discrepancies?

---

## 9. Verification & Test Coverage Summary

The Cash Foundation is verified through 9 automated tests in `apps/api/src/modules/cash/cash.test.ts`:
1. `admin cash account references existing admin user` (FK constraint)
2. `duplicate holder/account protection` (UNIQUE admin_id constraint)
3. `cash transaction amount uses BIGINT paise` (CHECK amount_paise > 0)
4. `transaction direction and type validation` (CHECK constraints)
5. `append-only financial record protection` (Trigger blocks UPDATE & DELETE)
6. `derived cash balance calculation` (Balance = SUM(CREDIT) - SUM(DEBIT))
7. `FK protection against deleting an admin with cash history` (ON DELETE RESTRICT)
8. `transaction-scoped repository behavior` (Atomic coordination & rollback)
9. `test data isolation` (Persistent SUPER_ADMIN preserved & zero residual test records)
