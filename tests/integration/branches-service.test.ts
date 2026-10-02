import { beforeAll, describe, expect, it, vi } from "vitest";
import { fixtureTenants } from "@/db/seed/fixtures";

// Integration across domains in fixture mode (no DATABASE_URL):
// branches.service → staff / appointments / billing / tenants services → repositories.
beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "");
});

describe("branches service (fixture mode)", () => {
  it("composes a tenant's branch overview from other domains' services", async () => {
    const { getOverview } = await import("@/server/branches/service");
    const overview = await getOverview(fixtureTenants[0].id);

    expect(overview.source).toBe("demo");
    expect(overview.currency).toBe("USD");
    expect(overview.branches.map((b) => b.name)).toEqual(["Downtown Flagship", "Beverly Hills Studio", "West Hollywood"]);
    expect(overview.branches[0]).toMatchObject({ staffCount: 12, appointmentsToday: 24, revenueTodayCents: 428_000 });
  });

  it("never leaks another tenant's branches", async () => {
    const { getOverview } = await import("@/server/branches/service");
    const overview = await getOverview(fixtureTenants[1].id);
    expect(overview.branches).toHaveLength(1);
    expect(overview.branches[0]!.name).toContain("Bro Barber");
  });
});
