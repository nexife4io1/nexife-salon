import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// PGlite-backed: appointments.service -> branches/staff/customers/tenants services -> real SQL with every migration applied.
vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

type TenantContext = import("@/server/shared/context").TenantContext;
type BookInput = import("@/server/appointments/schema").BookAppointmentInput;
let tenants: typeof import("@/server/tenants/service");
let branches: typeof import("@/server/branches/service");
let staff: typeof import("@/server/staff/service");
let appts: typeof import("@/server/appointments/service");
let schema: typeof import("@/server/appointments/schema");
let staffSchema: typeof import("@/server/staff/schema");
let tables: typeof import("@/db/schema");
let db: ReturnType<typeof import("@/db/client").getDb>;

const ctxFor = (tenantId: string, role: TenantContext["role"] = "owner"): TenantContext => ({ tenantId, userId: "u", role, session: {} as never });

const templates: { id: string; name: string; minutes: number }[] = [];

type T = Awaited<ReturnType<typeof newTenant>>;

async function newTenant(slug: string, timezone = "UTC") {
  const id = await tenants.onboardTenant({
    tenant: { name: slug, slug, currency: "USD", timezone },
    owner: { name: "Owner", username: `owner-${slug}`, password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
    branch: { name: `HQ ${slug}`, addressLine: "1 Main St", offeredTemplateIds: [templates[0]!.id, templates[1]!.id] },
    services: templates.map((t) => ({ templateId: t.id, priceCents: 1_000, durationMinutes: t.minutes })),
  });
  const [branch] = await db.select().from(tables.branches).where(eq(tables.branches.tenantId, id));
  const services = await db.select().from(tables.services).where(eq(tables.services.tenantId, id));
  const byName = (name: string) => services.find((s) => s.name === name)!.id;
  const [customer] = await db.insert(tables.customers).values({ tenantId: id, name: "Cara Customer" }).returning();
  const member = async (name: string, branchId = branch!.id) =>
    (await staff.createStaff(ctxFor(id), staffSchema.staffInputSchema.parse({ name, branchId }))).id;
  return {
    id,
    ctx: ctxFor(id),
    branchId: branch!.id,
    haircut: byName("Haircut"), // 30 min, offered
    color: byName("Color"), // 90 min, offered
    perm: byName("Perm"), // 60 min, NOT offered by the branch
    customerId: customer!.id,
    member,
  };
}

const book = (t: T, over: Partial<Record<keyof BookInput, string>> = {}, now?: Date) =>
  appts.book(
    t.ctx,
    schema.bookAppointmentInputSchema.parse({ branchId: t.branchId, serviceId: t.haircut, customerId: t.customerId, date: "2026-10-20", time: "10:00", ...over }),
    now ?? new Date("2026-10-16T08:00:00Z"),
  );

const NOW = new Date("2026-10-16T08:00:00Z");
const board = (t: T, raw: Record<string, string> = {}) => appts.getBoard(t.ctx, schema.parseAppointmentFilters(raw), NOW);

beforeAll(async () => {
  tenants = await import("@/server/tenants/service");
  branches = await import("@/server/branches/service");
  staff = await import("@/server/staff/service");
  appts = await import("@/server/appointments/service");
  schema = await import("@/server/appointments/schema");
  staffSchema = await import("@/server/staff/schema");
  tables = await import("@/db/schema");
  db = (await import("@/db/client")).getDb();
  for (const [name, minutes] of [["Haircut", 30], ["Color", 90], ["Perm", 60]] as const) {
    const tpl = await tenants.createServiceTemplate({ name, category: "Hair", audience: "unisex", defaultDurationMinutes: minutes, defaultPriceCents: 5_000 });
    templates.push({ id: tpl.id, name, minutes });
  }
});

describe("booking", () => {
  it("persists a booking and shows it on the board with the service duration", async () => {
    const t = await newTenant("book");
    const stylist = await t.member("Sam Stylist");
    const { id, date } = await book(t, { staffId: stylist, serviceId: t.color, notes: "  Bring reference photo " });
    expect(date).toBe("2026-10-20");

    const view = await board(t, { date: "2026-10-20" });
    expect(view.appointments).toHaveLength(1);
    expect(view.appointments[0]).toMatchObject({
      id,
      customerName: "Cara Customer",
      staffName: "Sam Stylist",
      serviceName: "Color",
      durationMinutes: 90,
      type: "booking",
      status: "booked",
      notes: "Bring reference photo",
    });
    expect(view.appointments[0]!.startsAt.toISOString()).toBe("2026-10-20T10:00:00.000Z");
    expect(view.appointments[0]!.endsAt.toISOString()).toBe("2026-10-20T11:30:00.000Z");
    expect(view.counts.booked).toBe(1);
    expect(view.staff.map((s) => s.name)).toEqual(["Sam Stylist"]);
  });

  it("accepts a walk-in with no customer, starting now", async () => {
    const t = await newTenant("walkin");
    await book(t, { type: "walk_in", customerId: "", date: "", time: "" }, NOW);
    const view = await board(t, { date: "2026-10-16" });
    expect(view.appointments[0]).toMatchObject({ type: "walk_in", customerName: null, status: "booked" });
    expect(view.appointments[0]!.startsAt.toISOString()).toBe("2026-10-16T08:00:00.000Z");
  });

  it("requires a customer, date and time for a booking (but not for walk-ins)", () => {
    const base = { branchId: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01", serviceId: "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a02" };
    const paths = (raw: Record<string, unknown>) => {
      const r = schema.bookAppointmentInputSchema.safeParse(raw);
      return r.success ? null : r.error.issues.map((i) => i.path.join(".")).sort();
    };
    expect(paths({ ...base })).toEqual(["customerId", "date", "time"]);
    expect(paths({ ...base, type: "walk_in" })).toBeNull();
    expect(paths({ ...base, type: "walk_in", date: "2026-02-31" })).toEqual(["date"]);
  });

  it("rejects bookings in the past but allows a few minutes of grace", async () => {
    const t = await newTenant("past");
    await expect(book(t, { date: "2026-10-15" })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { time: [expect.stringContaining("passed")] } });
    await expect(book(t, { date: "2026-10-16", time: "07:57" })).resolves.toBeTruthy();
  });
});

describe("tenant timezone", () => {
  it("interprets the booking in the tenant's zone and stores a timezone-aware instant", async () => {
    const t = await newTenant("kolkata", "Asia/Kolkata"); // UTC+5:30
    await book(t, { date: "2026-10-20", time: "09:00" });
    const [row] = await db.select().from(tables.appointments).where(eq(tables.appointments.tenantId, t.id));
    expect(row!.startsAt.toISOString()).toBe("2026-10-20T03:30:00.000Z");
  });

  it("buckets by the tenant's calendar day, not the UTC day", async () => {
    const t = await newTenant("la", "America/Los_Angeles"); // UTC-7 in October
    await book(t, { date: "2026-10-20", time: "23:30" }); // 06:30Z on the 21st
    await book(t, { date: "2026-10-21", time: "00:30" }); // 07:30Z on the 21st

    expect((await board(t, { date: "2026-10-20" })).appointments).toHaveLength(1);
    expect((await board(t, { date: "2026-10-21" })).appointments).toHaveLength(1);
    expect((await board(t, { date: "2026-10-22" })).appointments).toHaveLength(0);
  });

  it("defaults the board to the tenant's today and handles DST days", async () => {
    const t = await newTenant("la-today", "America/Los_Angeles");
    // 2026-10-17T03:00Z is still Oct 16 in Los Angeles.
    const view = await appts.getBoard(t.ctx, {}, new Date("2026-10-17T03:00:00Z"));
    expect(view.date).toBe("2026-10-16");
    expect(view.today).toBe("2026-10-16");
  });

  it("rejects a wall-clock time that DST skips", async () => {
    const t = await newTenant("dst", "America/New_York");
    // US clocks jump 02:00 -> 03:00 on 2027-03-14.
    await expect(book(t, { date: "2027-03-14", time: "02:30" })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { time: [expect.stringContaining("doesn't exist")] } });
    await expect(book(t, { date: "2027-03-14", time: "03:30" })).resolves.toBeTruthy();
  });

  it("counts a branch's appointments for the tenant-local day", async () => {
    const t = await newTenant("count", "Asia/Kolkata");
    await book(t, { date: "2026-10-16", time: "18:00" }); // 12:30Z, still "today" for the tenant
    const counts = await appts.countTodayByBranch(t.id, NOW);
    expect(counts.get(t.branchId)).toBe(1);
  });
});

describe("staff conflicts", () => {
  it("rejects an overlapping booking for the same staff member using the service duration", async () => {
    const t = await newTenant("conflict");
    const sam = await t.member("Sam Stylist");
    await book(t, { staffId: sam, serviceId: t.color, time: "10:00" }); // 10:00-11:30

    for (const time of ["10:00", "10:30", "11:00", "11:29"]) {
      await expect(book(t, { staffId: sam, time })).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { staffId: [expect.stringContaining("10:00–11:30")] } });
    }
    // A long booking starting before an existing one but running into it also collides.
    await expect(book(t, { staffId: sam, serviceId: t.color, time: "09:00" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await board(t, { date: "2026-10-20" })).appointments).toHaveLength(1);
  });

  it("allows back-to-back bookings and other staff at the same time", async () => {
    const t = await newTenant("adjacent");
    const sam = await t.member("Sam Stylist");
    const kim = await t.member("Kim Colorist");
    await book(t, { staffId: sam, time: "10:00" }); // 10:00-10:30
    await expect(book(t, { staffId: sam, time: "10:30" })).resolves.toBeTruthy();
    await expect(book(t, { staffId: sam, time: "09:30" })).resolves.toBeTruthy(); // ends exactly at 10:00
    await expect(book(t, { staffId: kim, time: "10:00" })).resolves.toBeTruthy();
  });

  it("frees the slot when an appointment is cancelled or marked no-show, but not when completed", async () => {
    const t = await newTenant("free");
    const sam = await t.member("Sam Stylist");
    const first = await book(t, { staffId: sam, time: "10:00" });
    await appts.changeStatus(t.ctx, { id: first.id, status: "cancelled" });
    const again = await book(t, { staffId: sam, time: "10:00" });
    await appts.changeStatus(t.ctx, { id: again.id, status: "no_show" });
    const third = await book(t, { staffId: sam, time: "10:00" });
    for (const status of ["checked_in", "in_service", "completed"] as const) await appts.changeStatus(t.ctx, { id: third.id, status });
    await expect(book(t, { staffId: sam, time: "10:15" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("never treats unassigned bookings as conflicting with each other or with staff", async () => {
    const t = await newTenant("unassigned");
    const sam = await t.member("Sam Stylist");
    await book(t, { time: "10:00" });
    await book(t, { time: "10:00" });
    await expect(book(t, { staffId: sam, time: "10:00" })).resolves.toBeTruthy();

    const view = await board(t, { date: "2026-10-20" });
    expect(view.appointments.filter((a) => a.staffId === null)).toHaveLength(2);
  });

  it("lets only one of two simultaneous overlapping requests through", async () => {
    const t = await newTenant("race");
    const sam = await t.member("Sam Stylist");
    const results = await Promise.allSettled([book(t, { staffId: sam, time: "10:00" }), book(t, { staffId: sam, time: "10:15" })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await board(t, { date: "2026-10-20" })).appointments).toHaveLength(1);
  });

  it("enforces declared staff qualifications but leaves staff with none unrestricted", async () => {
    const t = await newTenant("qualified");
    const sam = await t.member("Sam Stylist");
    const kim = await t.member("Kim Colorist");
    await db.insert(tables.staffServices).values({ tenantId: t.id, staffId: kim, serviceId: t.color });

    await expect(book(t, { staffId: kim, serviceId: t.haircut })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { staffId: [expect.stringContaining("doesn't perform")] } });
    await expect(book(t, { staffId: kim, serviceId: t.color })).resolves.toBeTruthy();
    await expect(book(t, { staffId: sam, serviceId: t.haircut, time: "12:00" })).resolves.toBeTruthy();
  });
});

describe("validation and tenant isolation", () => {
  it("rejects a branch, service, staff or customer from another tenant", async () => {
    const a = await newTenant("iso-a");
    const b = await newTenant("iso-b");
    const bStaff = await b.member("B Stylist");

    await expect(book(a, { branchId: b.branchId })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { branchId: expect.any(Array) } });
    await expect(book(a, { serviceId: b.haircut })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { serviceId: expect.any(Array) } });
    await expect(book(a, { staffId: bStaff })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { staffId: expect.any(Array) } });
    await expect(book(a, { customerId: b.customerId })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { customerId: expect.any(Array) } });
    expect(await db.select().from(tables.appointments).where(eq(tables.appointments.tenantId, a.id))).toHaveLength(0);
  });

  it("keeps boards and status changes private to the owning tenant", async () => {
    const a = await newTenant("priv-a");
    const b = await newTenant("priv-b");
    const mine = await book(a);

    expect((await board(b, { date: "2026-10-20" })).appointments).toHaveLength(0);
    await expect(appts.changeStatus(b.ctx, { id: mine.id, status: "checked_in" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await board(a, { date: "2026-10-20" })).appointments[0]!.status).toBe("booked");
  });

  it("requires the branch to offer the service, the staff member to work there, and everything to be active", async () => {
    const t = await newTenant("compat");
    const [second] = await db.insert(tables.branches).values({ tenantId: t.id, name: "Second", addressLine: "2 Side St" }).returning();
    const otherBranchStaff = await t.member("Out Of Town", second!.id);
    const retired = await t.member("Retired Rita");
    await staff.setStatus(t.ctx, retired, "inactive");

    await expect(book(t, { serviceId: t.perm })).rejects.toMatchObject({ fieldErrors: { serviceId: [expect.stringContaining("doesn't offer")] } });
    await expect(book(t, { staffId: otherBranchStaff })).rejects.toMatchObject({ fieldErrors: { staffId: [expect.stringContaining("doesn't work at this branch")] } });
    await expect(book(t, { staffId: retired })).rejects.toMatchObject({ fieldErrors: { staffId: expect.any(Array) } });
    await expect(book(t, { branchId: second!.id })).rejects.toMatchObject({ fieldErrors: { serviceId: [expect.stringContaining("doesn't offer")] } });

    await db.update(tables.branches).set({ status: "inactive" }).where(eq(tables.branches.id, second!.id));
    await expect(book(t, { branchId: second!.id })).rejects.toMatchObject({ fieldErrors: { branchId: [expect.stringContaining("inactive")] } });

    await tenants.updateTenantService({ tenantId: t.id, serviceId: t.haircut, priceCents: 1_000, durationMinutes: 30, active: false });
    await expect(book(t)).rejects.toMatchObject({ fieldErrors: { serviceId: expect.any(Array) } });
  });

  it("filters the board by branch and status without disturbing the day's counts", async () => {
    const t = await newTenant("filters");
    const [second] = await db.insert(tables.branches).values({ tenantId: t.id, name: "Second", addressLine: "2 Side St" }).returning();
    await branches.setBranchServices(t.ctx, second!.id, [t.haircut]);
    const first = await book(t, { time: "09:00" });
    await book(t, { time: "10:00", branchId: second!.id });
    await appts.changeStatus(t.ctx, { id: first.id, status: "checked_in" });

    expect((await board(t, { date: "2026-10-20" })).appointments).toHaveLength(2);
    const byBranch = await board(t, { date: "2026-10-20", branchId: second!.id });
    expect(byBranch.appointments).toHaveLength(1);
    const byStatus = await board(t, { date: "2026-10-20", status: "checked_in" });
    expect(byStatus.appointments.map((a) => a.id)).toEqual([first.id]);
    expect(byStatus.counts).toMatchObject({ booked: 1, checked_in: 1 });
  });

  it("offers booking choices scoped to the tenant", async () => {
    const a = await newTenant("opt-a");
    await newTenant("opt-b");
    await a.member("Sam Stylist");
    const options = await appts.getBookingOptions(a.ctx, NOW);
    expect(options).toMatchObject({ timezone: "UTC", today: "2026-10-16", nowTime: "08:00" });
    expect(options.customers.map((c) => c.name)).toEqual(["Cara Customer"]);
    expect(options.staff.map((s) => s.name)).toEqual(["Sam Stylist"]);
    expect(options.services.map((s) => s.name).sort()).toEqual(["Color", "Haircut", "Perm"]);
    expect(options.offeredByBranch[a.branchId]!.sort()).toEqual([a.color, a.haircut].sort());
  });
});

describe("status changes", () => {
  it("walks the happy path: booked -> checked in -> in service -> completed", async () => {
    const t = await newTenant("flow");
    const { id } = await book(t);
    for (const status of ["checked_in", "in_service", "completed"] as const) {
      await appts.changeStatus(t.ctx, { id, status });
      expect((await board(t, { date: "2026-10-20" })).appointments[0]!.status).toBe(status);
    }
  });

  it("rejects illegal moves and leaves the status alone", async () => {
    const t = await newTenant("illegal");
    const { id } = await book(t);
    await expect(appts.changeStatus(t.ctx, { id, status: "completed" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(appts.changeStatus(t.ctx, { id, status: "in_service" })).rejects.toMatchObject({ code: "CONFLICT" });
    await appts.changeStatus(t.ctx, { id, status: "cancelled" });
    for (const status of ["checked_in", "no_show", "cancelled"] as const) {
      await expect(appts.changeStatus(t.ctx, { id, status })).rejects.toMatchObject({ code: "CONFLICT" });
    }
    expect((await board(t, { date: "2026-10-20" })).appointments[0]!.status).toBe("cancelled");
  });

  it("allows no-show only before check-in and cancel until service starts", async () => {
    const t = await newTenant("rules");
    const a = await book(t, { time: "09:00" });
    await appts.changeStatus(t.ctx, { id: a.id, status: "checked_in" });
    await expect(appts.changeStatus(t.ctx, { id: a.id, status: "no_show" })).rejects.toMatchObject({ code: "CONFLICT" });
    await appts.changeStatus(t.ctx, { id: a.id, status: "in_service" });
    await expect(appts.changeStatus(t.ctx, { id: a.id, status: "cancelled" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("reports a missing appointment as not found", async () => {
    const t = await newTenant("missing");
    await expect(appts.changeStatus(t.ctx, { id: "7d3c9f62-1d0a-4e1b-9a55-ffffffffffff", status: "checked_in" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("defines transitions consistently", () => {
    expect(schema.canTransition("booked", "checked_in")).toBe(true);
    expect(schema.canTransition("completed", "cancelled")).toBe(false);
    expect(schema.STATUS_TRANSITIONS.no_show).toEqual([]);
  });
});
