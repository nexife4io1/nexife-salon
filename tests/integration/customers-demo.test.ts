import { beforeAll, describe, expect, it, vi } from "vitest";
import { fixtureTenants } from "@/db/seed/fixtures";

// Demo mode (no DATABASE_URL): customers have no fixtures, so reads are empty and writes say "needs a database".
beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "");
});

const tenantId = fixtureTenants[0].id;

describe("customers service (fixture mode)", () => {
  it("serves an empty, demo-flagged directory with no invented data", async () => {
    const { getDirectory } = await import("@/server/customers/service");
    expect(await getDirectory(tenantId, { sort: "recent", page: 1 })).toMatchObject({
      source: "demo",
      customers: [],
      matching: 0,
      page: 1,
      pageCount: 1,
      stats: { total: 0, newThisMonth: 0, returning: 0 },
    });
  });

  it("has no profiles", async () => {
    const { getProfile } = await import("@/server/customers/service");
    await expect(getProfile(tenantId, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses to create or update without a database", async () => {
    const { createCustomer, updateCustomer } = await import("@/server/customers/service");
    const { customerInputSchema } = await import("@/server/customers/schema");
    const input = customerInputSchema.parse({ name: "Sophia Loren", phone: "5550100001" });
    await expect(createCustomer(tenantId, input)).rejects.toMatchObject({ name: "DatabaseNotConfiguredError" });
    await expect(updateCustomer(tenantId, "00000000-0000-4000-8000-000000000000", input)).rejects.toMatchObject({ name: "DatabaseNotConfiguredError" });
  });
});
