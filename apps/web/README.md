# `@vanigar/web`

Next.js (App Router) presentation layer for the Vanigar Sangam Management System.

**Boundary:** UI only. No database access, ORM, repository or business-rule code
lives here. Backend functionality is reached exclusively through the API
boundary in `src/lib/api`. The visual design system is introduced in a later
phase.

## Status

**Phase 1.2 — web application foundation.**

Present:

- App Router structure with root layout, global stylesheet and viewport config
- `loading`, `error` and `not-found` boundaries
- accessibility baseline (semantic landmarks, document language, visible focus,
  reduced-motion support, page metadata)
- generic web → API communication boundary (`src/lib/api`)
- component / hooks / types directory boundaries

Not present (by design): authentication, sessions, business routes, business
components, and the charcoal/ivory/terracotta/olive/gold design system.

## Structure

```
src/
├── app/            layout.tsx · globals.css · page.tsx
│                   loading.tsx · error.tsx · not-found.tsx
├── components/     ui/ · layout/   (boundaries only)
├── lib/api/        config.ts · client.ts · index.ts
├── hooks/          (empty until needed)
└── types/          (empty until needed)
```

See [`src/README.md`](src/README.md) for the full boundary rules.

## API communication

```ts
import { apiRequest, ApiRequestError } from '@/lib/api';

const data = await apiRequest<SomeDto>('/resource', { query: { page: 1 } });
```

- Base URL: `getApiBaseUrl()` — defaults to `http://localhost:4000/api/v1` and
  can be overridden with `NEXT_PUBLIC_API_URL`.
- Failures throw `ApiRequestError` (`status`, `code`, `message`, `details`);
  transport failures use `status: 0` and code `NETWORK`.
- No authentication, session or endpoint-specific client exists yet.

## Commands

```bash
npm run dev:web     # from the repository root
npm run build:web
```
