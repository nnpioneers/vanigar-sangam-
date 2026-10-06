# Vanigar Sangam Management System

Production-oriented management system for a traders association (Vanigar Sangam):
members, daily collections, savings, loans, guarantors, repayments, cash handling,
reports, documents and audit history.

> **Status:** Phase 1.1 — repository / monorepo foundation.
> No business logic, no database schema, no authentication, no UI screens yet.

## Stack

| Layer     | Technology                            |
| --------- | ------------------------------------- |
| Frontend  | Next.js · React · TypeScript          |
| Backend   | Node.js · Express · TypeScript (REST) |
| Database  | PostgreSQL (schema arrives later)     |
| Workspace | npm workspaces monorepo               |

## Repository layout

```
apps/
  web/          Next.js presentation layer (UI only)
  api/          Node.js REST API (HTTP / application layer)
packages/
  rules/        Pure business-rule logic (boundary only in Phase 1.1)
  shared-types/ Reusable shared TypeScript contracts
  validation/   Reusable structural validation utilities
  config/       Centralised configuration access
database/       Migrations, seeds and database documentation (no tables yet)
docs/           Architecture, development and database documentation
tests/          Cross-application end-to-end tests (reserved)
scripts/        Development helper scripts
```

### Boundary rules

- `apps/web` → presentation/UI only. No database access, no business rules in components.
- `apps/api` → HTTP/API/application layer. No business rules inside route handlers.
- `packages/rules` → pure business-rule logic only. No I/O.
- `packages/shared-types` → reusable type contracts only.
- `packages/validation` → reusable structural validation only.
- `packages/config` → centralised configuration access only.
- No circular package dependencies.

## Getting started

```bash
npm install          # install all workspace dependencies
npm run build:ts     # build packages + api (TypeScript project references)
npm run typecheck    # type-check every workspace
npm run lint         # lint API + packages, then the web app
npm run format:check # verify formatting

npm run dev:web      # Next.js dev server
npm run dev:api      # API dev server (http://localhost:4000)
npm run start:api    # API from compiled output
```

## Scripts

| Script                            | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `npm run build`                   | Build TypeScript projects, then the web app       |
| `npm run build:ts`                | Build `packages/*` and `apps/api` via `tsc -b`    |
| `npm run build:web`               | `next build`                                      |
| `npm run typecheck`               | Type-check all workspaces without failing on emit |
| `npm run lint` / `lint:fix`       | ESLint across the repository                      |
| `npm run format` / `format:check` | Prettier write / verify                           |
| `npm run dev:web`                 | Start the Next.js dev server                      |
| `npm run dev:api`                 | Start the API in watch mode                       |
| `npm run start:api`               | Start the API from compiled output                |
| `npm run clean`                   | Remove build output                               |

## Environment

Copy `.env.example` to `.env` and fill local values. Real credentials are never
committed.

## Documentation

- [`docs/architecture/`](docs/architecture/) — architecture decisions
- [`docs/development/`](docs/development/) — development workflow
- [`docs/database/`](docs/database/) — database documentation
- [`database/`](database/) — migrations and seeds
