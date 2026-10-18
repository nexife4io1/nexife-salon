import { beforeAll, describe, expect, it, vi } from "vitest";
import { fixtureBranches, fixtureTenants } from "@/db/seed/fixtures";

// Demo mode (no DATABASE_URL): reads come from fixtures (no appointments), writes report "needs a database".
beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "");
});

const ctx = { tenantId: fixtureTenants[0].id, userId: "u", role: "owner" as const, session: {} as never };

describe("appointments service (fixture mode)", () => {
  it("serves an empty, demo-flagged board in the tenant timezone", async () => {
    const { getBoard } = await import("@/server/appointments/service");
    const board = await getBoard(ctx, {}, new Date("2026-10-17T03:00:00Z"));
    expect(board).toMatchObject({ source: "demo", timezone: "America/Los_Angeles", date: "2026-10-16", appointments: [] });
    expect(board.branches.map((b) => b.name)).toContain(fixtureBranches[0].name);
  });

  it("refuses to book or change status without a database", async () => {
    const { book, changeStatus } = await import("@/server/appointments/service");
    const { bookAppointmentInputSchema } = await import("@/server/appointments/schema");
    const input = bookAppointmentInputSchema.parse({ branchId: fixtureBranches[0].id, serviceId: fixtureBranches[0].id, type: "walk_in" });
    await expect(book(ctx, input)).rejects.toMatchObject({ name: "DatabaseNotConfiguredError" });
    await expect(changeStatus(ctx, { id: fixtureBranches[0].id, status: "cancelled" })).rejects.toMatchObject({ name: "DatabaseNotConfiguredError" });
  });

  it("keeps the fixture branch counts", async () => {
    const { countTodayByBranch } = await import("@/server/appointments/service");
    expect((await countTodayByBranch(fixtureTenants[0].id)).get(fixtureBranches[0].id)).toBe(24);
  });
});
