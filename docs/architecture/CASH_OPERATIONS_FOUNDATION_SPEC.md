# Phase 4.2 — Cash Operations Foundation: Admin Cash Transfers & Reconciliation

## Overview
This document specifies the structural foundation for administrative cash transfers and physical cash reconciliations in the Vanigar Sangam application. This builds upon the Minimal Cash Foundation (Phase 4.1) by establishing mechanisms for inter-admin money movement and discrepancy tracking, without locking in unresolved business policies.

## Unresolved Business Policies
As established in Phase 0, several critical policies remain unresolved. The architecture implements the structural foundation for these but does NOT enforce specific business rules:

1. **Negative Cash Balance Policy**: The database and service layers do not enforce strict positive balances (e.g. `balance >= 0` check constraint is omitted).
2. **Transfer Handover Acknowledgement**: Implemented as a single-step authoritative transfer (`COMPLETED` status directly) but schema supports `PENDING` status to enable two-step acknowledgements if required in the future.
3. **Overnight Cash Retention Limits**: No automated checks or restrictions are enforced during transfers or reconciliations.
4. **Adjustment Authorization Policy**: Discrepancies identified during reconciliation are recorded but no automatic adjustment transactions are created. A separate explicit adjustment workflow must be built when policies are finalized.

## Schema Implementation

### `cash_transfers`
Records the intent and execution of moving cash between two administrative accounts.
- `id`: UUID Primary Key
- `source_account_id`: UUID (REFERENCES admin_cash_accounts)
- `destination_account_id`: UUID (REFERENCES admin_cash_accounts)
- `amount_paise`: BIGINT (> 0)
- `status`: VARCHAR ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED')
- `idempotency_key`: VARCHAR (UNIQUE) - Ensures duplicate requests (e.g. from network retries) do not result in double transfers.
- `notes`: TEXT
- `initiated_by_admin_id`: UUID
- **Immutability**: `DELETE` operations are strictly prohibited via PostgreSQL triggers.

### `cash_reconciliations`
Records the outcome of a physical cash count compared against the system's derived balance.
- `id`: UUID Primary Key
- `account_id`: UUID (REFERENCES admin_cash_accounts)
- `expected_balance_paise`: BIGINT
- `actual_balance_paise`: BIGINT
- `discrepancy_paise`: BIGINT (`actual_balance_paise - expected_balance_paise`)
- `status`: VARCHAR ('PENDING', 'RESOLVED')
- `notes`: TEXT
- `performed_by_admin_id`: UUID
- **Immutability**: `DELETE` operations and `UPDATE` on core financial fields (balances, account) are strictly prohibited via PostgreSQL triggers.

## Module Architecture (Service & Repository Layer)

### `CashService.transferCash()`
Executes an authoritative cash transfer between two admins.
1. Validates that the source and destination are different accounts.
2. Checks for an existing transfer via `idempotency_key` (if provided) and returns it if found.
3. Executes within a `withTransaction` block:
   - Verifies both accounts are ACTIVE.
   - Creates the `cash_transfers` record.
   - Records a `DEBIT` transaction against the source account (transaction_type: 'TRANSFER_OUT').
   - Records a `CREDIT` transaction against the destination account (transaction_type: 'TRANSFER_IN').

### `CashService.recordReconciliation()`
Records a cash count event.
1. Computes the current system balance (`expected_balance_paise`) via `getDerivedBalance`.
2. Validates that the provided expected balance matches the current system balance to prevent race conditions during counting.
3. Computes `discrepancy_paise` and inserts the `cash_reconciliations` record.

## API Endpoints
The following structural endpoints are exposed via `CashController` in `cash.routes.ts`:

- `POST /api/v1/cash/transfers`: Initiates a cash transfer.
- `POST /api/v1/cash/reconciliations`: Records a physical cash count.

*Note: These endpoints currently return the created entity data. Full validation pipelines and DTO schemas will be bound once API contracts for the web app are finalized.*

## Testing Foundation
Automated test suite (`npm run test:cash`) expanded to verify:
- **Idempotency Mechanism**: Repeated calls with the same `idempotency_key` return the identical transfer without creating duplicate ledger entries.
- **Immutability Protection**: PostgreSQL triggers actively block `DELETE` and financial `UPDATE` statements against `cash_reconciliations` and `cash_transfers`.
