import { beforeAll, describe, expect, it, vi } from "vitest";
import { fixtureBranches, fixtureTenants } from "@/db/seed/fixtures";

// Demo mode (no DATABASE_URL): reads come from fixtures, writes report "needs a database".
beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "");
});

const ctx = { tenantId: fixtureTenants[0].id, userId: "u", role: "owner" as const, session: {} as never };

describe("billing service (fixture mode)", () => {
  it("is read-only: recording a payment needs a database", async () => {
    const { recordPayment } = await import("@/server/billing/service");
    const { recordPaymentInputSchema } = await import("@/server/billing/schema");
    const input = recordPaymentInputSchema.parse({
      appointmentId: fixtureBranches[0].id,
      lines: [{ kind: "custom", name: "x", priceCents: 100 }],
      payments: [{ method: "cash", amountCents: 100 }],
    });
    await expect(recordPayment(ctx, input)).rejects.toMatchObject({ name: "DatabaseNotConfiguredError" });
  });

  it("has no receipts, open tickets or payments to show", async () => {
    const { getOverview, getReceipt } = await import("@/server/billing/service");
    expect(await getOverview(ctx.tenantId)).toMatchObject({ source: "demo", openTickets: [], recent: [], averageTicketTodayCents: null });
    await expect(getReceipt(ctx, fixtureBranches[0].id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
