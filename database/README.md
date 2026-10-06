# database/

PostgreSQL schema work lives here.

```
migrations/   ordered, versioned migration files (forward-only)
seeds/        reference data (rule tables, permission codes) + dev-only fixtures
docs/         schema notes and table documentation
```

## Rules

- **No business tables exist yet.** Phase 1.1 only establishes the directory
  structure; tables arrive in later phases alongside their requirements.
- The schema changes **only** through reviewed migration files. Never modify a
  database by hand — least of all production.
- Reference seeds (confirmed rule values, permission codes) are separated from
  dev-only fixtures; fixtures never run in production.
- Money columns are `BIGINT` values in **paise** — never floating point.
- Ledger and audit tables are append-only.

## Status

| Item                | State                                        |
| ------------------- | -------------------------------------------- |
| Migrations pipeline | planned (tooling chosen in a later phase)    |
| Business tables     | none — Phase 1.1 is directory structure only |
| Seed data           | none                                         |
