import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, it, vi } from "vitest";

/**
 * Appointment-path measurements on in-process Postgres (PGlite). Opt in with PERF=1; it never runs in `npm run check`.
 *   PERF=1 npx vitest run tests/integration/appointments-perf.test.ts
 * It reports SQL statement counts (deterministic) and wall time (a median of several runs; local PGlite has no
 * network latency, so statement count x your real round-trip time is the number that matters against a remote DB).
 */
const counter = { statements: 0, sql: [] as string[] };
vi.mock("@/db/client", async () => {
  // Count every statement that reaches Postgres: wrap the query method of the connection and of each transaction.
  const { PGlite } = await import("@electric-sql/pglite");
  const proto = PGlite.prototype as unknown as { query: (...a: unknown[]) => unknown; transaction: (cb: (tx: { query: (...a: unknown[]) => unknown }) => unknown) => unknown };
  const query = proto.query;
  const transaction = proto.transaction;
  proto.query = function (this: unknown, ...a: unknown[]) {
    counter.statements++;
    counter.sql.push(String(a[0]));
    return query.apply(this, a);
  };
  proto.transaction = function (this: unknown, cb) {
    return transaction.call(this, (tx) => {
      const q = tx.query.bind(tx);
      tx.query = (...a: unknown[]) => (counter.statements++, counter.sql.push(String(a[0])), q(...a));
      return cb(tx);
    });
  };
  return (await import("../support/pglite-db")).createTestDbModule();
});

const run = process.env.PERF ? describe : describe.skip;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

run("appointment path (PGlite)", () => {
  let tenantId = "";
  let ctx: import("@/server/shared/context").TenantContext;
  beforeAll(async () => {
    const tenants = await import("@/server/tenants/service");
    const tables = await import("@/db/schema");
    const { getDb } = await import("@/db/client");
    const db = getDb();
    const tpl = [];
    for (let i = 0; i < 12; i++) tpl.push(await tenants.createServiceTemplate({ name: `Svc ${i}`, category: "Hair", audience: "unisex", defaultDurationMinutes: 30, defaultPriceCents: 5000 }));
    tenantId = await tenants.onboardTenant({
      tenant: { name: "perf", slug: "perf", currency: "USD", timezone: "UTC" },
      owner: { name: "Owner", username: "owner-perf", password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
      branch: { name: "HQ", addressLine: "1 Main St", offeredTemplateIds: tpl.map((t) => t.id) },
      services: tpl.map((t) => ({ templateId: t.id, priceCents: 1000, durationMinutes: 30 })),
    });
    ctx = { tenantId, userId: "u", role: "owner", session: {} as never };
    const [hq] = await db.select().from(tables.branches).where(eq(tables.branches.tenantId, tenantId));
    for (let b = 0; b < 4; b++) await db.insert(tables.branches).values({ tenantId, name: `Branch ${b}`, addressLine: "x" });
    const svc = await db.select().from(tables.services).where(eq(tables.services.tenantId, tenantId));
    const people = await db.insert(tables.staff).values(Array.from({ length: 20 }, (_, i) => ({ tenantId, branchId: hq!.id, name: `Staff ${i}`, initials: "S" }))).returning();
    const custs = await db.insert(tables.customers).values(Array.from({ length: 500 }, (_, i) => ({ tenantId, name: `Customer ${i}`, phone: `+1555${String(i).padStart(7, "0")}`, phoneKey: `k${i}` }))).returning();
    const day = new Date("2026-10-20T00:00:00Z");
    for (let i = 0; i < 120; i++) {
      const [a] = await db.insert(tables.appointments).values({
        tenantId, branchId: hq!.id, customerId: custs[i]!.id, serviceId: svc[i % 12]!.id, staffId: people[i % 20]!.id,
        startsAt: new Date(day.getTime() + (8 + (i % 10)) * 3_600_000), status: (["booked", "checked_in", "in_service", "completed"] as const)[i % 4],
      }).returning();
      await db.insert(tables.appointmentServices).values([0, 1, 2].map((k) => ({ tenantId, appointmentId: a!.id, serviceId: svc[(i + k) % 12]!.id, name: `Svc ${k}`, priceCents: 1000, durationMinutes: 30, position: k })));
    }
    await db.execute(sql`analyze`);
  });

  const measure = async (label: string, fn: () => Promise<unknown>) => {
    await fn(); // warm up
    const times: number[] = [];
    let statements = 0;
    let bytes = 0;
    for (let i = 0; i < 7; i++) {
      counter.statements = 0;
      counter.sql = [];
      const t0 = performance.now();
      const result = await fn();
      times.push(performance.now() - t0);
      statements = counter.statements;
      if (i === 0) bytes = JSON.stringify(result).length;
    }
    if (process.env.PERF_SQL) {
      const byTable = new Map<string, number>();
      for (const text of counter.sql) {
        const key = /^(begin|commit|select set_config)/i.test(text) ? "transaction overhead (begin / set_config / commit)" : (/from "salon"."(w+)"/i.exec(text)?.[1] ?? text.slice(0, 30));
        byTable.set(key, (byTable.get(key) ?? 0) + 1);
      }
      process.stderr.write(`  ${label}: ${[...byTable].map(([k, n]) => `${k} x${n}`).join(", ")}
`);
    }
    process.stderr.write(`PERF ${label.padEnd(34)} statements=${String(statements).padStart(3)}  median=${median(times).toFixed(1)}ms  payload=${(bytes / 1024).toFixed(1)}KB
`);
  };

  it("reports", async () => {
    const appts = await import("@/server/appointments/service");
    const schema = await import("@/server/appointments/schema");
    const now = new Date("2026-10-20T07:00:00Z");
    await measure("booking options (/appointments/new)", () => appts.getBookingOptions(ctx, now));
    await measure("board, upcoming (/appointments)", () => appts.getBoard(ctx, schema.parseAppointmentFilters({ date: "2026-10-20" }), now));
    await measure("board, completed", () => appts.getBoard(ctx, schema.parseAppointmentFilters({ date: "2026-10-20", status: "completed" }), now));
  }, 120_000);
});
