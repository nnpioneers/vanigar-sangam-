# VANIGAR SANGAM — CORE DOMAIN BOUNDARY & BUSINESS MODULE SPECIFICATION

**Version:** 1.0.0  
**Phase:** Phase 3.3 — Core Domain Boundary & Business Module Registration Foundation  
**Status:** Approved Architectural Standard  

---

## 1. Overview & Objective

The **Vanigar Sangam** system is implemented as a **Modular Monolith**. This architecture combines the operational simplicity of a single deployable application with the rigorous boundaries, clean domain separation, and low coupling typical of microservices.

This document defines the strict boundary conventions, directory layout, dependency rules, and cross-module coordination protocols that all future business modules must follow.

---

## 2. Domain Module Catalog

The following modules constitute the operational domains of the system:

| Module Name | Base Route Path | Primary Responsibility |
| :--- | :--- | :--- |
| **`auth`** | `/api/v1/auth` | Administrator authentication, session management, RBAC enforcement |
| **`members`** | `/api/v1/members` | Member lifecycle, shop information, sheet ownership, nominees, insurance |
| **`daily-sheets`** | `/api/v1/daily-sheets` | Daily collection sheet opening, daily totals, day closure & lock |
| **`collections`** | `/api/v1/collections` | Member daily installment recording, arrears rollover, advance allocations |
| **`loans`** | `/api/v1/loans` | Loan application, 100-day schedule calculation, approval, disbursement |
| **`guarantors`** | `/api/v1/guarantors` | Member guarantor eligibility verification, exposure limits, responsibility math |
| **`cash`** | `/api/v1/cash` | Admin physical cash holding tracking, admin-to-admin cash transfers |
| **`reports`** | `/api/v1/reports` | Daily collection summaries, overdue loans analysis, cash reconciliation exports |
| **`audit`** | `/api/v1/audit-logs` | Immutable system audit trail, administrative action tracking |

---

## 3. Standard Module File Structure

Each domain module will be organized according to a standardized, self-contained layout:

```text
apps/api/src/modules/<module-name>/
├── <module-name>.routes.ts       # Express router definitions and middleware guards
├── <module-name>.controller.ts   # HTTP request parsing, response status codes, envelopes
├── <module-name>.service.ts      # Domain orchestration, business rule coordination, transactions
├── <module-name>.repository.ts   # Parameterized SQL queries and entity row mappers
├── <module-name>.types.ts        # Module-specific DTOs, domain models, and input interfaces
├── <module-name>.test.ts         # Module unit and integration tests
└── index.ts                      # Public module exports and AppModule definition
```

---

## 4. Layered Dependency Direction

The application enforces a **strict unidirectional dependency flow**:

```
┌────────────────────────────────────────┐
│               HTTP Layer               │
│          (Routes & Controllers)        │
└───────────────────┬────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│           Application Layer            │
│               (Services)               │
└─────────┬────────────────────┬─────────┘
          │                    │
          ▼                    ▼
┌───────────────────┐    ┌───────────────────┐
│   Domain Layer    │    │ Repository Layer  │
│  (@vanigar/rules) │    │  (BaseRepository) │
└───────────────────┘    └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │   PostgreSQL 18   │
                         │   Database Pool   │
                         └───────────────────┘
```

### Strict Architectural Invariants:
1. **No HTTP in Domain/Service Layers:**
   - Services and Repositories must **never** import `Request`, `Response`, or `NextFunction` from `express`.
   - Services accept pure TypeScript DTOs and return typed domain records or throw typed `AppError` subclasses.
2. **No SQL in Controllers or Services:**
   - Controllers and Services must **never** write raw SQL queries or touch `pg.Pool` directly.
   - All database interaction must flow through dedicated Repositories extending `BaseRepository`.
3. **No Direct Cross-Module Table Manipulation:**
   - Module A's repository must **never** execute `INSERT`, `UPDATE`, or `DELETE` on Module B's database tables.
   - Modules must interact exclusively through public Service interfaces.
4. **No UI Imports in Backend:**
   - Backend code in `apps/api` must never import React, Next.js, CSS modules, or DOM types.

---

## 5. Cross-Module Coordination & Transaction Propagation

In financial workflows, operations frequently span multiple modules (e.g., disbursing a loan requires updating loan status, adjusting admin cash holding, and writing an audit log).

To execute cross-module operations atomically without coupling repositories:

### 5.1 The `ServiceContext` Pattern
Every service method capable of participating in an atomic transaction accepts an optional `ServiceContext`:

```typescript
export interface ServiceContext {
  readonly tx?: Queryable;
  readonly adminId?: string;
  readonly requestId?: string;
}
```

### 5.2 Transaction Propagation Example
```typescript
// Coordinating Service (e.g. LoanDisbursementCoordinator)
await withTransaction(async (client) => {
  const context: ServiceContext = { tx: client, adminId: actor.id };

  // 1. Update loan status via LoanService
  await loanService.disburseLoan(loanId, context);

  // 2. Adjust admin physical cash holding via CashService
  await cashService.recordDisbursement(adminId, amount, context);

  // 3. Write immutable audit log entry via AuditService
  await auditService.logAction('LOAN_DISBURSED', loanId, context);
});
```

- If **any** step fails or throws an exception, `withTransaction` automatically issues a database `ROLLBACK`.
- Neither module accesses the other module's private database tables or internal SQL.
- Each service merely delegates its queries to its own repository, passing `context.tx`.

---

## 6. Module Registration Contract (`AppModule`)

Each module registers itself with the central `ModuleRegistry` in `apps/api/src/modules/registry.ts`:

```typescript
export interface AppModule {
  readonly name: string;
  readonly basePath: string;
  readonly router: Router;
}
```

In `apps/api/src/app.ts`:
```typescript
// Declarative mounting of all registered domain modules
registry.mountAll(app);
```

This guarantees:
- Predictable and uniform route mounting across all modules.
- Prevention of route namespace collisions.
- Ability to test individual modules in complete isolation.

---

## 7. Testing Standards for Modules

Each future domain module must supply:
1. **Unit Tests:** Testing business rules and DTO validations in isolation without database dependencies.
2. **Repository Integration Tests:** Testing SQL queries and constraint enforcement against live PostgreSQL with savepoint rollbacks.
3. **Service Coordination Tests:** Testing transaction commit and rollback behavior using `withTransaction`.
4. **API Integration Tests:** Testing HTTP status codes, session protection, RBAC guards, and response envelope shapes (`{ data, error }`).
