<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Nexife Salon — project rules

Modular monolith: one Next.js app, three modules. Read `docs/ARCHITECTURE.md` before adding features.

- `app/`, `components/` are frontend. They may import `server/<domain>/{actions,queries,schema}` only — never `service.ts`, `repository.ts` or `db/`.
- Only `server/<domain>/repository.ts` touches `db/`. Cross-domain calls go through the other domain's `service.ts`.
- Route handlers under `app/api/` may call services directly.
- Every tenant-scoped repository function takes `tenantId` and runs through `withTenant()` (RLS).
- Do not add new in-memory domain state. Fixtures in `db/seed/fixtures.ts` are read-only demo data.
- Use design tokens from `app/globals.css` and primitives from `components/ui/`; the Branches page is the visual reference.
- Run `npm run check` (lint + typecheck + tests) before finishing a change. Boundaries are enforced by `eslint.config.mjs`.
