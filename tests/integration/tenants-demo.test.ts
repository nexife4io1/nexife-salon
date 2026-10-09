import { beforeAll, describe, expect, it, vi } from "vitest";
import { fixtureServiceTemplates, fixtureTenants } from "@/db/seed/fixtures";

// Demo mode (no DATABASE_URL): platform reads fall back to fixtures, writes fail with a friendly error.
beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "");
});

describe("tenants service (fixture mode)", () => {
  it("summarises fixture tenants with counts", async () => {
    const { listTenantSummaries, dataSource } = await import("@/server/tenants/service");
    const summaries = await listTenantSummaries();
    expect(dataSource()).toBe("demo");
    expect(summaries.map((t) => t.slug)).toEqual(["meridian", "bro-barber"]);
    expect(summaries[0]).toMatchObject({ branchCount: 3, userCount: 2, serviceCount: 3 });
  });

  it("returns detail for a fixture tenant and NOT_FOUND otherwise", async () => {
    const { getTenantDetail } = await import("@/server/tenants/service");
    const detail = await getTenantDetail(fixtureTenants[0].id);
    expect(detail.owners.map((o) => o.username)).toEqual(["sarah"]);
    expect(detail.branches).toHaveLength(3);
    await expect(getTenantDetail("7d3c9f62-1d0a-4e1b-9a55-ffffffffffff")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("serves the template catalog", async () => {
    const { listServiceTemplates } = await import("@/server/tenants/service");
    expect(await listServiceTemplates()).toHaveLength(fixtureServiceTemplates.length);
  });

  it("refuses to write without a database", async () => {
    const { createServiceTemplate } = await import("@/server/tenants/service");
    await expect(createServiceTemplate({ name: "Nope", category: null, audience: "unisex" as const, defaultDurationMinutes: 30, defaultPriceCents: 100 })).rejects.toMatchObject({
      name: "DatabaseNotConfiguredError",
    });
  });
});
