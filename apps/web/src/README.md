# `apps/web/src`

Source root of the Next.js presentation layer.

```
src/
├── app/           App Router: root layout, global CSS, loading/error/not-found
│                  boundaries, and the root route. Business routes are added
│                  later, grouped by module — never empty placeholders.
├── components/    Presentational components (see components/README.md)
├── lib/           Presentation utilities; lib/api/ is the web → API boundary
├── hooks/         Client/server-safe reusable hooks (empty until needed)
└── types/         Web-only TypeScript declarations (empty until needed)
```

## Boundaries

- **Presentation only.** No database, ORM, repository or business-rule code is
  ever imported here. Backend access happens exclusively through `lib/api`.
- **Server Components by default.** `'use client'` is added only where
  client-side behaviour is genuinely required (for example the error boundary).
- **No business rules in components.** Values rendered here are computed by the
  API and simply displayed.
- **No state-management library** is introduced unless a phase genuinely needs it.

## Route organisation

Only structural boundaries that carry real value are created. Future modules
arrive as real routes together with their functionality — no empty
`/login`, `/dashboard`, `/members`, `/daily-sheet`, `/loans`, `/cash`,
`/collections`, `/reports` or `/admin` folders are created in advance.
