import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// PGlite-backed: staff.service -> branches/tenants services -> real SQL with every migration applied.
vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

type TenantContext = import("@/server/shared/context").TenantContext;
type StaffInput = import("@/server/staff/schema").StaffInput;
let tenants: typeof import("@/server/tenants/service");
let branches: typeof import("@/server/branches/service");
let staff: typeof import("@/server/staff/service");
let schema: typeof import("@/server/staff/schema");
let tables: typeof import("@/db/schema");
let db: ReturnType<typeof import("@/db/client").getDb>;

const ctxFor = (tenantId: string, role: TenantContext["role"] = "owner"): TenantContext => ({ tenantId, userId: "u", role, session: {} as never });

const templateIds: string[] = [];

async function newTenant(slug: string, timezone = "UTC") {
  const id = await tenants.onboardTenant({
    tenant: { name: slug, slug, currency: "USD", timezone },
    owner: { name: "Owner", username: `owner-${slug}`, password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
    branch: { name: `HQ ${slug}`, addressLine: "1 Main St", offeredTemplateIds: [] },
    services: templateIds.map((templateId) => ({ templateId, priceCents: 1_000, durationMinutes: 30 })),
  });
  const [branch] = await db.select().from(tables.branches).where(eq(tables.branches.tenantId, id));
  return { id, branchId: branch!.id };
}

const parse = (raw: Record<string, unknown>): StaffInput => schema.staffInputSchema.parse(raw);

beforeAll(async () => {
  tenants = await import("@/server/tenants/service");
  branches = await import("@/server/branches/service");
  staff = await import("@/server/staff/service");
  schema = await import("@/server/staff/schema");
  tables = await import("@/db/schema");
  db = (await import("@/db/client")).getDb();
  for (const name of ["Haircut", "Balayage"]) {
    templateIds.push((await tenants.createServiceTemplate({ name, category: "Hair", audience: "unisex", defaultDurationMinutes: 45, defaultPriceCents: 5_500 })).id);
  }
});

describe("staff management", () => {
  it("creates a full profile and reads it back with schedule and breaks", async () => {
    const t = await newTenant("full");
    const { id } = await staff.createStaff(
      ctxFor(t.id),
      parse({
        name: "Elena Rodriguez",
        title: "Master Colorist",
        phone: "+91 98765 43210",
        gender: "female",
        branchId: t.branchId,
        jobRole: "hair_stylist",
        monthlySalaryCents: "45,000.50",
        yearsExperience: "8",
        joinedOn: "2024-03-01",
        casualLeaves: "12",
        recruitmentSource: "Referral",
        weeklyOff: "sunday",
        shiftStart: "09:00",
        shiftEnd: "18:00",
        breaks: [{ label: "Lunch", start: "13:00", end: "14:00" }],
      }),
    );

    const profile = await staff.getProfile(ctxFor(t.id), id);
    expect(profile).toMatchObject({
      name: "Elena Rodriguez",
      initials: "ER",
      status: "active",
      active: true,
      monthlySalaryCents: 4_500_050,
      yearsExperience: 8,
      joinedOn: "2024-03-01",
      casualLeaves: 12,
      jobRole: "hair_stylist",
      branchName: expect.stringContaining("HQ"),
    });
    expect(profile.schedule.weeklyOffDay).toBe(0);
    expect(profile.schedule.hours.map((h) => h.day)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(profile.schedule.hours[0]).toEqual({ day: 1, start: "09:00", end: "18:00" });
    expect(profile.schedule.breaks).toEqual([{ label: "Lunch", start: "13:00", end: "14:00" }]);
  });

  it("updates profile and replaces schedule and breaks", async () => {
    const t = await newTenant("update");
    const base = { name: "Sam Lee", branchId: t.branchId, shiftStart: "10:00", shiftEnd: "19:00", breaks: [{ start: "14:00", end: "14:30" }] };
    const { id } = await staff.createStaff(ctxFor(t.id), parse(base));

    await staff.updateStaff(ctxFor(t.id), id, parse({ ...base, name: "Samantha Lee", weeklyOff: "monday", shiftStart: "08:00", breaks: [], status: "active" }));
    const p = await staff.getProfile(ctxFor(t.id), id);
    expect(p).toMatchObject({ name: "Samantha Lee", initials: "SL", status: "active", active: true });
    expect(p.schedule.breaks).toEqual([]);
    expect(p.schedule.hours.find((h) => h.day === 1)).toBeUndefined();
    expect(p.schedule.hours[0]!.start).toBe("08:00");
  });

  it("derives availability from status and schedule in the tenant timezone", async () => {
    const t = await newTenant("avail", "Asia/Kolkata");
    const { id } = await staff.createStaff(
      ctxFor(t.id),
      parse({ name: "Dina Shah", branchId: t.branchId, weeklyOff: "sunday", shiftStart: "09:00", shiftEnd: "18:00", breaks: [{ start: "13:00", end: "14:00" }] }),
    );
    const at = (iso: string) => staff.getProfile(ctxFor(t.id), id, new Date(iso)).then((p) => p.availability);

    // 2026-10-14 is a Wednesday; Asia/Kolkata = UTC+5:30.
    expect(await at("2026-10-14T05:00:00Z")).toMatchObject({ state: "available" }); // 10:30 local
    expect(await at("2026-10-14T08:00:00Z")).toMatchObject({ state: "on_break" }); // 13:30 local
    expect(await at("2026-10-14T14:00:00Z")).toMatchObject({ state: "off_shift" }); // 19:30 local
    expect(await at("2026-10-18T05:00:00Z")).toMatchObject({ state: "day_off" }); // Sunday

    await db.update(tables.staff).set({ status: "on_leave" }).where(eq(tables.staff.id, id));
    expect(await staff.getProfile(ctxFor(t.id), id, new Date("2026-10-14T05:00:00Z"))).toMatchObject({
      status: "active",
      availability: { state: "available" },
    });
    expect(await at("2026-10-14T05:00:00Z")).toMatchObject({ state: "available" });
    await staff.setStatus(ctxFor(t.id), id, "inactive");
    expect(await at("2026-10-14T05:00:00Z")).toMatchObject({ state: "inactive" });
  });

  it("does not claim availability when no schedule exists", async () => {
    const t = await newTenant("nosched");
    const { id } = await staff.createStaff(ctxFor(t.id), parse({ name: "No Schedule", branchId: t.branchId }));
    expect((await staff.getProfile(ctxFor(t.id), id)).availability.state).toBe("unscheduled");
  });

  it("keeps the legacy active flag, branch staff counts and old consumers in step with status", async () => {
    const t = await newTenant("compat");
    const a = await staff.createStaff(ctxFor(t.id), parse({ name: "Ann One", branchId: t.branchId }));
    await staff.createStaff(ctxFor(t.id), parse({ name: "Bob Two", branchId: t.branchId }));
    expect((await branches.getOverview(t.id)).branches[0]!.staffCount).toBe(2);

    await staff.setStatus(ctxFor(t.id), a.id, "inactive");
    expect((await branches.getOverview(t.id)).branches[0]!.staffCount).toBe(1);
    expect((await staff.listStaff(t.id)).find((s) => s.id === a.id)).toMatchObject({ active: false });

    await staff.setStatus(ctxFor(t.id), a.id, "active"); // still employed, still counted
    expect((await branches.getOverview(t.id)).branches[0]!.staffCount).toBe(2);
  });

  it("searches and filters the directory by name, title, branch and status", async () => {
    const t = await newTenant("filters");
    const other = await branches.createBranch(ctxFor(t.id), { name: "Second", addressLine: "2 Side St", status: "active", serviceIds: [] });
    await staff.createStaff(ctxFor(t.id), parse({ name: "Olivia Bennett", title: "Lead Colorist", branchId: t.branchId }));
    const marcus = await staff.createStaff(ctxFor(t.id), parse({ name: "Marcus Reed", title: "Barber", branchId: other.id }));
    await staff.setStatus(ctxFor(t.id), marcus.id, "inactive");

    const names = async (f: import("@/server/staff/schema").StaffFilters) => (await staff.getDirectory(ctxFor(t.id), f)).staff.map((s) => s.name);
    expect(await names({})).toEqual(["Marcus Reed", "Olivia Bennett"]);
    expect(await names({ q: "olivia" })).toEqual(["Olivia Bennett"]);
    expect(await names({ q: "colorist" })).toEqual(["Olivia Bennett"]);
    expect(await names({ q: "100%" })).toEqual([]); // LIKE wildcards are escaped
    expect(await names({ branchId: other.id })).toEqual(["Marcus Reed"]);
    expect(await names({ status: "inactive" })).toEqual(["Marcus Reed"]);
    expect(await names({ status: "active", branchId: other.id })).toEqual([]);
  });

  it("keeps sensitive fields out of directory rows", async () => {
    const t = await newTenant("privacy");
    await staff.createStaff(ctxFor(t.id), parse({ name: "Priv Acy", branchId: t.branchId, phone: "+1 555 0100", monthlySalaryCents: "5000" }));
    const [row] = (await staff.getDirectory(ctxFor(t.id), {})).staff;
    expect(row).not.toHaveProperty("phone");
    expect(row).not.toHaveProperty("monthlySalaryCents");
  });

  it("rejects branches that belong to another tenant", async () => {
    const a = await newTenant("iso-a");
    const b = await newTenant("iso-b");

    await expect(staff.createStaff(ctxFor(a.id), parse({ name: "Cross Branch", branchId: b.branchId }))).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { branchId: expect.any(Array) },
    });
    expect(await db.select().from(tables.staff).where(eq(tables.staff.tenantId, a.id))).toHaveLength(0);
  });

  it("never reads or writes another tenant's staff", async () => {
    const a = await newTenant("own-a");
    const b = await newTenant("own-b");
    const { id } = await staff.createStaff(ctxFor(a.id), parse({ name: "Tenant A Person", branchId: a.branchId }));

    await expect(staff.getProfile(ctxFor(b.id), id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(staff.updateStaff(ctxFor(b.id), id, parse({ name: "Hijack", branchId: b.branchId }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(staff.setStatus(ctxFor(b.id), id, "inactive")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await staff.getDirectory(ctxFor(b.id), {})).staff).toEqual([]);
    expect((await staff.getProfile(ctxFor(a.id), id)).status).toBe("active");
  });

  it("restricts reads and writes to owners and managers", async () => {
    const t = await newTenant("perms");
    const { id } = await staff.createStaff(ctxFor(t.id, "manager"), parse({ name: "Mgr Made", branchId: t.branchId }));
    const front = ctxFor(t.id, "staff");
    await expect(staff.getDirectory(front, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staff.getProfile(front, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staff.getFormOptions(front)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staff.createStaff(front, parse({ name: "Nope Nope", branchId: t.branchId }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staff.updateStaff(front, id, parse({ name: "Nope Nope", branchId: t.branchId }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staff.setStatus(front, id, "inactive")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets an existing assignment stay on a branch that was later deactivated, but not a new one", async () => {
    const t = await newTenant("inactive-branch");
    const second = await branches.createBranch(ctxFor(t.id), { name: "Closing", addressLine: "9 Last St", status: "inactive", serviceIds: [] });
    await expect(staff.createStaff(ctxFor(t.id), parse({ name: "To Closed", branchId: second.id }))).rejects.toMatchObject({ code: "VALIDATION" });

    const { id } = await staff.createStaff(ctxFor(t.id), parse({ name: "Stays Put", branchId: t.branchId }));
    await db.update(tables.staff).set({ branchId: second.id }).where(eq(tables.staff.id, id));
    await expect(staff.updateStaff(ctxFor(t.id), id, parse({ name: "Stays Put II", branchId: second.id }))).resolves.toBeUndefined();
  });
});
