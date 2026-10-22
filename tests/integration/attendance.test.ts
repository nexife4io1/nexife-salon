import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

type TenantContext = import("@/server/shared/context").TenantContext;
let tenants: typeof import("@/server/tenants/service");
let staff: typeof import("@/server/staff/service");
let attendance: typeof import("@/server/attendance/service");
let staffSchema: typeof import("@/server/staff/schema");
let tables: typeof import("@/db/schema");
let db: ReturnType<typeof import("@/db/client").getDb>;
let templateId: string;

const contexts = new Map<string, TenantContext>();
const ctxFor = (tenantId: string, role: TenantContext["role"] = "owner") => ({ ...contexts.get(tenantId)!, role });

async function newTenant(slug: string) {
  const tenantId = await tenants.onboardTenant({
    tenant: { name: slug, slug, currency: "USD", timezone: "UTC" },
    owner: { name: "Owner", username: `owner-${slug}`, password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
    branch: { name: `HQ ${slug}`, addressLine: "1 Main St", offeredTemplateIds: [templateId] },
    services: [{ templateId, priceCents: 1_000, durationMinutes: 30 }],
  });
  const [branch] = await db.select().from(tables.branches).where(eq(tables.branches.tenantId, tenantId));
  const [user] = await db.select().from(tables.users).where(eq(tables.users.tenantId, tenantId));
  contexts.set(tenantId, { tenantId, userId: user!.id, role: "owner", session: {} as never });
  return { tenantId, branchId: branch!.id };
}

beforeAll(async () => {
  tenants = await import("@/server/tenants/service");
  staff = await import("@/server/staff/service");
  attendance = await import("@/server/attendance/service");
  staffSchema = await import("@/server/staff/schema");
  tables = await import("@/db/schema");
  db = (await import("@/db/client")).getDb();
  templateId = (await tenants.createServiceTemplate({
    name: "Haircut",
    category: "Hair",
    audience: "unisex",
    defaultDurationMinutes: 30,
    defaultPriceCents: 1_000,
  })).id;
});

describe("attendance management", () => {
  it("supports split shifts, date-bounded leave, and present-over-leave precedence", async () => {
    const tenant = await newTenant("attendance");
    const staffId = (await staff.createStaff(
      ctxFor(tenant.tenantId),
      staffSchema.staffInputSchema.parse({
        name: "Mina Shah",
        branchId: tenant.branchId,
        weeklyOff: "sunday",
        shiftStart: "09:00",
        shiftEnd: "12:00",
      }),
    )).id;

    await attendance.addRecurringShift(ctxFor(tenant.tenantId), { staffId, day: 3, start: "15:00", end: "18:00" });
    await expect(attendance.addRecurringShift(ctxFor(tenant.tenantId), { staffId, day: 3, start: "11:00", end: "16:00" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    const overview = await attendance.getOverview(ctxFor(tenant.tenantId), "2026-10-14");
    const member = overview.board.staff.find((item) => item.id === staffId)!;
    expect(member.shifts.map((shift) => [shift.start, shift.end])).toEqual([["09:00", "12:00"], ["15:00", "18:00"]]);
    await attendance.recordAttendance(ctxFor(tenant.tenantId), {
      staffId,
      shiftId: member.shifts[1]!.id,
      workDate: "2026-10-21",
      clockIn: "15:00",
      clockOut: "18:00",
    });
    await expect(attendance.removeRecurringShift(ctxFor(tenant.tenantId), member.shifts[1]!.id))
      .rejects.toMatchObject({ code: "CONFLICT" });

    await attendance.createLeave(ctxFor(tenant.tenantId), { staffId, fromDate: "2026-10-14", toDate: "2026-10-15", reason: "Personal leave" });
    const firstShift = member.shifts[0]!;
    await attendance.recordAttendance(ctxFor(tenant.tenantId), {
      staffId,
      shiftId: firstShift.id,
      workDate: "2026-10-14",
      clockIn: "09:05",
      clockOut: "12:00",
    });

    const onLeaveDate = (await attendance.getOverview(ctxFor(tenant.tenantId), "2026-10-14")).board.staff.find((item) => item.id === staffId)!;
    expect(onLeaveDate.leave?.reason).toBe("Personal leave");
    expect(onLeaveDate.shifts.map((shift) => Boolean(shift.attendance))).toEqual([true, false]);
    expect((await attendance.getOverview(ctxFor(tenant.tenantId), "2026-10-16")).board.staff.find((item) => item.id === staffId)?.leave).toBeNull();
  });

  it("restricts attendance management to owners and managers", async () => {
    const tenant = await newTenant("attendancerole");
    await expect(attendance.getOverview(ctxFor(tenant.tenantId, "staff"), "2026-10-14")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
