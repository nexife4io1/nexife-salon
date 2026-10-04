# Nexife Salon — Architecture (skeleton v0.1)

This is the starting point described in `Materials/Nexife-Salon-Architecture-Vision.docx`:
a **modular monolith**. One repo, one build, one Next.js process, split into three
modules with import boundaries that the linter enforces.

```
┌──────────────────────────── FRONTEND ────────────────────────────┐
│ app/          routes, layouts, loading/error states, thin API     │
│ components/   ui/ (primitives) · layout/ (shell) · views/ (domain)│
└───────────────┬──────────────────────────────────────────────────┘
                │ imports only server/<domain>/{queries,actions,schema}
┌───────────────▼──────────── BACKEND ─────────────────────────────┐
│ server/<domain>/                                                  │
│   schema.ts      zod contracts + types (safe to import from UI)   │
│   queries.ts     Server Component reads  (authn + RBAC + tenant)  │
│   actions.ts     Server Actions — writes  (authn + RBAC + zod)    │
│   service.ts     business rules; cross-domain calls go here       │
│   repository.ts  the ONLY files that touch db/                    │
│ server/shared/   session, rbac, context, errors, result           │
└───────────────┬──────────────────────────────────────────────────┘
                │ only repository.ts
┌───────────────▼──────────── DATABASE ────────────────────────────┐
│ db/client.ts   typed Drizzle client + withTenant() (RLS)          │
│ db/schema/     salon.* tables (tenant_id everywhere)              │
│ db/migrations/ 0000_init (generated) · 0001_rls (hand-written)    │
│ db/seed/       fixtures.ts (demo data) · index.ts (seed script)   │
└──────────────────────────────────────────────────────────────────┘
```

## Boundary rules (enforced in `eslint.config.mjs`)

| From                        | May import                                            | May **not** import                         |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------ |
| `app/`, `components/`       | `server/*/queries`, `server/*/actions`, `server/*/schema`, `server/shared/*` types | `server/*/service`, any `repository`, `db/`, `drizzle-orm`, `postgres` |
| `app/api/**` route handlers | the above **plus** `server/*/service`                 | `repository`, `db/`                        |
| `server/**` (non-repository)| own `./repository`, other domains' `service`          | `db/`, other domains' `repository`, `app/`, `components/` |
| `server/**/repository.ts`   | `db/`                                                 | other domains' `repository`                |
| `lib/`                      | Node/std only                                         | `server/`, `db/`, `app/`, `components/`    |

`service.ts`, `repository.ts` and `queries.ts` also `import "server-only"`, so the bundler
fails if client code reaches them.

### Request flow

**Read (Server Component):**
`app/(app)/branches/page.tsx` → `server/branches/queries.getBranchesOverview()`
→ `requireTenantContext("branches")` (session + RBAC) → `branches/service.getOverview()`
→ `staff`/`appointments`/`billing`/`tenants` **services** → each domain's repository → DB.

**Write (Server Action):**
`components/views/branches/branch-form.tsx` (`useActionState`) → `server/branches/actions.createBranchAction`
→ `getTenantContext` → zod parse → `service.createBranch` (role check) → `repository.insert`
→ `revalidatePath` + `redirect`. Failures come back as a typed `ActionResult`.

## Data modes

| `DATABASE_URL` | Behaviour |
| -------------- | --------- |
| **unset**      | Repositories read **read-only** fixtures from `db/seed/fixtures.ts`, so the UI runs on a laptop with no Postgres. Writes return a friendly "needs a database" error. Pages show a *Demo data* pill. Demo login works only outside production. |
| **set**        | Real queries through Drizzle. Run `npm run db:migrate && npm run db:seed` first. |

The fixtures are not a store: nothing mutates them. This replaces the POC's
`TENANT_SEEDS` / `TENANT_USERS` in-memory arrays without bringing them back.

## Multi-tenancy & RLS

- Every tenant-owned table has `tenant_id`. Core tables live in the `salon` Postgres
  schema, kept apart from the assistant's demo sales data.
- Repositories always filter by `tenantId` **and** run inside `withTenant(tenantId, …)`.
  That function sets `app.tenant_id` for the transaction.
- `0001_rls.sql` enables RLS with a `tenant_isolation` policy on every tenant table.
  **TODO (step 1):** connect the app as a non-owner `salon_app` role, because table owners
  bypass RLS. The migration file has the exact SQL.

## Auth

- The POC's session philosophy is kept: a stateless **HMAC-SHA256 signed cookie**
  (`server/shared/session-token.ts`, pure and unit-tested; `session.ts` reads and writes the
  cookie). No session table, no Supabase Auth, no Auth.js.
- Passwords are hashed with scrypt (`lib/password.ts`). DB users store only the hash.
- `proxy.ts` (Next 16's replacement for `middleware.ts`) does an **optimistic** cookie
  check. The real checks are in `queries.ts` and `actions.ts`, close to the data.
- RBAC lives in one place, `server/shared/rbac.ts`: role defaults plus per-user menu grants.
  Grants can narrow a role's defaults but never widen them.
- Env: `SESSION_SECRET` is required in production. Dev falls back to a fixed secret.

## AI & realtime: extension points only

- `server/assistant/` holds schema, a placeholder `service.reply()`, a `tools.ts` registry
  and an assistant-only `repository.ts`. UI → `app/api/assistant/chat/route.ts` → service.
- Streaming: add `service.streamReply()` and return a stream from the same route (step 11).
- Realtime: Supabase Realtime subscriptions for appointments, stock and notifications (step 12).
  No custom WebSocket server.
- Heavy AI work (image generation, bulk ingestion) moves to background jobs (step 12).
- See `server/assistant/README.md` for the POC port plan.

## Implementation roadmap (page by page)

Each step fills a domain's `repository → service → queries/actions → view` and removes
its `PlaceholderNote`. Search the code for `TODO(step N)`.

1. **Auth + Tenants foundation**: `salon_app` role for RLS, DB-backed login, tenant onboarding, tenant timezone in `lib/dates.ts`
2. **Branches refinement**: branch detail page, edit/deactivate, unique names
3. **Dashboard shell**: trends, up-next list, global search
4. **Staff + Services**: team CRUD, branch assignment, service catalog
5. **Customers**: profiles, history, de-duplication
6. **Appointments**: calendar, booking, check-in
7. **Billing + Payments**: checkout and payments ledger
8. **Inventory**: items, stock movements, low-stock
9. **Finance**: expenses, P&L
10. **Users / RBAC**: invites, menu grants, action-level permissions
11. **Assistant hardening**: port POC engine, streaming, pgvector
12. **Realtime + background jobs**
13. **Testing expansion**: Playwright e2e, component tests, CI
