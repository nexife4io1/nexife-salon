import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// PGlite-backed: attendance.service -> staff/tenants/branches services -> real SQL with every migration applied.
vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

type TenantContext = import("@/server/shared/context").TenantContext;
type Credentials = import("@/server/attendance/schema").AttendanceCredentials;
let tenants: typeof import("@/server/tenants/service");
let staff: typeof import("@/server/staff/service");
let staffSchema: typeof import("@/server/staff/schema");
let attendance: typeof import("@/server/attendance/service");
let tables: typeof import("@/db/schema");
let db: ReturnType<typeof import("@/db/client").getDb>;
let templateId: string;

const ctxFor = (tenantId: string, role: TenantContext["role"] = "owner"): TenantContext => ({ tenantId, userId: "u", role, session: {} as never });
const PHONE = "+91 98765 43210";
const IP = "203.0.113.7";

async function newTenant(slug: string, timezone = "UTC") {
  const id = await tenants.onboardTenant({
    tenant: { name: slug, slug, currency: "USD", timezone },
    owner: { name: "Owner", username: `owner-${slug}`, password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
    branch: { name: `HQ ${slug}`, addressLine: "1 Main St", offeredTemplateIds: [] },
    services: [{ templateId, priceCents: 1_000, durationMinutes: 30 }],
  });
  const [branch] = await db.select().from(tables.branches).where(eq(tables.branches.tenantId, id));
  return { id, slug, branchId: branch!.id };
}

async function newStaff(t: { id: string; branchId: string }, name = "Asha Rao") {
  const { id } = await staff.createStaff(ctxFor(t.id), staffSchema.staffInputSchema.parse({ name, phone: PHONE, branchId: t.branchId }));
  const code = await staff.regenerateRegistrationCode(ctxFor(t.id), id);
  return { id, code };
}

const creds = (salonCode: string, registrationCode: string, phone = PHONE): Credentials => ({
  salonCode,
  registrationCode,
  phone: phone.replace(/[^\d+]/g, ""),
});

beforeAll(async () => {
  tenants = await import("@/server/tenants/service");
  staff = await import("@/server/staff/service");
  staffSchema = await import("@/server/staff/schema");
  attendance = await import("@/server/attendance/service");
  tables = await import("@/db/schema");
  db = (await import("@/db/client")).getDb();
  templateId = (await tenants.createServiceTemplate({ name: "Haircut", category: "Hair", audience: "unisex", defaultDurationMinutes: 45, defaultPriceCents: 5_500 })).id;
});

describe("registration code", () => {
  it("is generated, shown on the profile to managers, and replaced on regenerate", async () => {
    const t = await newTenant("code-a");
    const s = await newStaff(t);
    expect(s.code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    expect((await staff.getProfile(ctxFor(t.id, "manager"), s.id)).registrationCode).toBe(s.code);

    const next = await staff.regenerateRegistrationCode(ctxFor(t.id), s.id);
    expect(next).not.toBe(s.code);
    expect((await staff.getProfile(ctxFor(t.id), s.id)).registrationCode).toBe(next);
  });

  it("is manager-only and tenant-scoped", async () => {
    const a = await newTenant("code-b1");
    const b = await newTenant("code-b2");
    const s = await newStaff(a);
    await expect(staff.regenerateRegistrationCode(ctxFor(a.id, "staff"), s.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(staff.regenerateRegistrationCode(ctxFor(b.id), s.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(staff.getProfile(ctxFor(b.id), s.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses staff without a branch", async () => {
    const t = await newTenant("code-c");
    const s = await newStaff(t);
    await db.update(tables.staff).set({ branchId: null }).where(eq(tables.staff.id, s.id));
    await expect(staff.regenerateRegistrationCode(ctxFor(t.id), s.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("device login", () => {
  it("accepts the right salon, code and phone (any phone formatting) and reports today", async () => {
    const t = await newTenant("login-a");
    const s = await newStaff(t);
    const session = await attendance.login(creds(t.slug, s.code, "+919876543210"), IP, new Date("2026-03-05T10:00:00Z"));
    expect(session).toMatchObject({ staffName: "Asha Rao", today: "2026-03-05", record: null, branchName: expect.stringContaining("HQ") });
  });

  it("rejects a wrong phone, wrong code and unknown salon with the same error", async () => {
    const t = await newTenant("login-b");
    const s = await newStaff(t);
    const errors = await Promise.all(
      [creds(t.slug, s.code, "+910000000000"), creds(t.slug, "ZZZZZZZZ"), creds("no-such-salon", s.code)].map((c) =>
        attendance.login(c, "198.51.100.1").catch((e) => e),
      ),
    );
    for (const e of errors) expect(e).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(new Set(errors.map((e) => e.message)).size).toBe(1);
  });

  it("does not let a code from one tenant work under another tenant's salon code", async () => {
    const a = await newTenant("login-c1");
    const b = await newTenant("login-c2");
    const s = await newStaff(a);
    await expect(attendance.login(creds(b.slug, s.code), "198.51.100.2")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects a regenerated (old) code and inactive staff", async () => {
    const t = await newTenant("login-d");
    const s = await newStaff(t);
    const old = s.code;
    await staff.regenerateRegistrationCode(ctxFor(t.id), s.id);
    await expect(attendance.login(creds(t.slug, old), "198.51.100.3")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });

    const fresh = (await staff.getProfile(ctxFor(t.id), s.id)).registrationCode!;
    await staff.setStatus(ctxFor(t.id), s.id, "inactive");
    await expect(attendance.login(creds(t.slug, fresh), "198.51.100.3")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throttles repeated failures, then blocks even a correct login from that caller until the window passes", async () => {
    const t = await newTenant("login-e");
    const s = await newStaff(t);
    const now = new Date("2026-03-05T10:00:00Z");
    for (let i = 0; i < 5; i++) await attendance.login(creds(t.slug, "ZZZZZZZZ"), "192.0.2.9", now).catch(() => undefined);
    await expect(attendance.login(creds(t.slug, s.code), "192.0.2.9", now)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("Too many"),
    });
    await expect(attendance.login(creds(t.slug, s.code), "192.0.2.10", now)).resolves.toBeDefined();
    await expect(attendance.login(creds(t.slug, s.code), "192.0.2.9", new Date(now.getTime() + 16 * 60_000))).resolves.toBeDefined();
  });
});

describe("recording attendance", () => {
  it("persists tenant, branch, staff and time, and shows it in the session", async () => {
    const t = await newTenant("mark-a");
    const s = await newStaff(t);
    const at = new Date("2026-03-05T09:30:00Z");
    const session = await attendance.mark(creds(t.slug, s.code), "check_in", IP, at);
    expect(session.record).toMatchObject({ workDate: "2026-03-05", checkInAt: at.toISOString(), checkOutAt: null });

    const [row] = await db.select().from(tables.staffAttendance).where(eq(tables.staffAttendance.staffId, s.id));
    expect(row).toMatchObject({ tenantId: t.id, branchId: t.branchId, workDate: "2026-03-05" });
  });

  it("prevents a second check-in on the same day but allows the next day", async () => {
    const t = await newTenant("mark-b");
    const s = await newStaff(t);
    const c = creds(t.slug, s.code);
    await attendance.mark(c, "check_in", IP, new Date("2026-03-05T09:00:00Z"));
    await expect(attendance.mark(c, "check_in", IP, new Date("2026-03-05T15:00:00Z"))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(attendance.mark(c, "check_in", IP, new Date("2026-03-06T09:00:00Z"))).resolves.toBeDefined();
    expect(await db.select().from(tables.staffAttendance).where(eq(tables.staffAttendance.staffId, s.id))).toHaveLength(2);
  });

  it("allows only one winner for concurrent check-ins", async () => {
    const t = await newTenant("mark-c");
    const s = await newStaff(t);
    const c = creds(t.slug, s.code);
    const at = new Date("2026-03-05T09:00:00Z");
    const results = await Promise.allSettled([attendance.mark(c, "check_in", IP, at), attendance.mark(c, "check_in", IP, at)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.select().from(tables.staffAttendance).where(eq(tables.staffAttendance.staffId, s.id))).toHaveLength(1);
  });

  it("uses the tenant's calendar day, not UTC", async () => {
    const t = await newTenant("mark-d", "Asia/Kolkata");
    const s = await newStaff(t);
    // 20:00 UTC on the 5th is 01:30 on the 6th in Kolkata.
    const session = await attendance.mark(creds(t.slug, s.code), "check_in", IP, new Date("2026-03-05T20:00:00Z"));
    expect(session.record?.workDate).toBe("2026-03-06");
    expect(session.today).toBe("2026-03-06");
  });

  it("checks out once, and only after checking in", async () => {
    const t = await newTenant("mark-e");
    const s = await newStaff(t);
    const c = creds(t.slug, s.code);
    await expect(attendance.mark(c, "check_out", IP, new Date("2026-03-05T17:00:00Z"))).rejects.toMatchObject({ code: "CONFLICT" });
    await attendance.mark(c, "check_in", IP, new Date("2026-03-05T09:00:00Z"));
    const out = await attendance.mark(c, "check_out", IP, new Date("2026-03-05T17:00:00Z"));
    expect(out.record?.checkOutAt).toBe("2026-03-05T17:00:00.000Z");
    await expect(attendance.mark(c, "check_out", IP, new Date("2026-03-05T18:00:00Z"))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("records nothing when credentials are wrong", async () => {
    const t = await newTenant("mark-f");
    const s = await newStaff(t);
    await expect(attendance.mark(creds(t.slug, s.code, "+910000000001"), "check_in", "198.51.100.50")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await db.select().from(tables.staffAttendance).where(eq(tables.staffAttendance.staffId, s.id))).toHaveLength(0);
  });
});

describe("attendance listing", () => {
  it("lists a staff member's records newest first, with the tenant timezone and salon code", async () => {
    const t = await newTenant("list-a", "Asia/Kolkata");
    const s = await newStaff(t);
    const c = creds(t.slug, s.code);
    await attendance.mark(c, "check_in", IP, new Date("2026-03-05T04:00:00Z"));
    await attendance.mark(c, "check_in", IP, new Date("2026-03-06T04:00:00Z"));
    const view = await attendance.listForStaff(ctxFor(t.id, "manager"), s.id);
    expect(view).toMatchObject({ salonCode: "list-a", timezone: "Asia/Kolkata" });
    expect(view.records.map((r) => r.workDate)).toEqual(["2026-03-06", "2026-03-05"]);
    expect(view.records[0]!.checkInAt).toBe("2026-03-06T04:00:00.000Z");
  });

  it("never shows another tenant's attendance and is manager-only", async () => {
    const a = await newTenant("list-b1");
    const b = await newTenant("list-b2");
    const s = await newStaff(a);
    await attendance.mark(creds(a.slug, s.code), "check_in", IP, new Date("2026-03-05T09:00:00Z"));
    expect((await attendance.listForStaff(ctxFor(b.id), s.id)).records).toEqual([]);
    expect((await attendance.listForStaff(ctxFor(a.id), s.id)).records).toHaveLength(1);
    await expect(attendance.listForStaff(ctxFor(a.id, "staff"), s.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
