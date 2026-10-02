# Nexife Salon

Premium salon management (salon line-of-business). It's a **modular monolith**: one
Next.js 16 app with separate frontend, backend and database modules.

> **Status: skeleton v0.1.** The architecture, app shell and design layer are in place.
> **Branches** is the first polished reference page. The other pages are deliberately
> simple placeholders, filled in one domain at a time (see the roadmap in
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)).

## Stack

Next.js 16.3.1 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · Zod 4 ·
Drizzle ORM + Supabase Postgres · Vitest

## Quick start (no database needed)

```bash
npm install
cp .env.example .env.local   # optional; defaults work for local UI work
npm run dev                  # http://localhost:3000
```

With no `DATABASE_URL`, the app runs on **read-only demo fixtures**. Sign in with:

| Username | Role           | Password      |
| -------- | -------------- | ------------- |
| `sarah`  | Owner          | `nexife-demo` |
| `maya`   | Manager        | `nexife-demo` |
| `dev`    | Owner (2nd tenant) | `nexife-demo` |
| `admin`  | Platform admin | `nexife-demo` |

(Change the password with `DEMO_PASSWORD`. Demo login is disabled in production builds.)

## With a database (Supabase Postgres)

```bash
# .env.local
DATABASE_URL=postgres://…        # Supabase direct or session-pooler URL
SESSION_SECRET=<32+ random chars>

npm run db:migrate   # creates the `salon` schema, tables and RLS policies
npm run db:seed      # demo tenants, branches, users (hashed passwords), services, staff
npm run dev
```

Change the schema in `db/schema/*`, then run `npm run db:generate` to write a new migration.

## Scripts

| Script               | What it does                                       |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Dev server (Turbopack)                             |
| `npm run build`      | Production build                                   |
| `npm run lint`       | ESLint, including **module-boundary rules**        |
| `npm run typecheck`  | `tsc --noEmit`                                     |
| `npm test`           | Vitest unit and integration tests                  |
| `npm run check`      | lint + typecheck + test                            |
| `npm run db:*`       | `generate`, `migrate`, `seed`, `studio`            |

## Layout

```
app/            FRONTEND: routes. (app)/ = authenticated shell; login/; api/ (thin handlers)
components/     FRONTEND: ui/ primitives · layout/ shell · views/ per-domain sections
server/         BACKEND: <domain>/{schema,queries,actions,service,repository}.ts + shared/
db/             DATABASE: client.ts · schema/ · migrations/ · seed/
lib/            framework-agnostic utilities (formatting, password hashing, dates)
tests/          unit/ · integration/ · e2e/ (placeholder)
docs/           ARCHITECTURE.md · DESIGN-SYSTEM.md
Materials/      architecture vision and Branches mockup (design source of truth)
```

Domains: `auth`, `tenants`, `branches`, `dashboard`, `appointments`, `customers`, `staff`
(including the service catalog), `billing`, `inventory`, `finance`, `assistant`.

## Key rules

- UI talks to the backend only through `server/<domain>/queries.ts` (reads) and `actions.ts`
  (Server Actions). Route handlers in `app/api` may call services.
- Only `repository.ts` files touch `db/`. Cross-domain logic goes through another domain's `service.ts`.
- Every tenant table has `tenant_id`; repositories run inside `withTenant()` so Postgres RLS applies.
- No new in-memory domain state.

The full details are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md).

## Next up

**Step 1: Auth + Tenants foundation.** Wire DB-backed login against `salon.users`, add the
`salon_app` role so RLS policies are enforced, and add tenant onboarding. Then **step 2**
fills in Branches (detail page, edit), which already has a working create flow.
