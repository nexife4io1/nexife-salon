import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// PGlite-backed: branches.service -> staff.service (active services) -> real SQL.
vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

type TenantContext = import("@/server/shared/context").TenantContext;
let tenants: typeof import("@/server/tenants/service");
let branches: typeof import("@/server/branches/service");
let schema: typeof import("@/db/schema");
let db: ReturnType<typeof import("@/db/client").getDb>;

let haircut: string;
let kids: string;
let facial: string;

const ctxFor = (tenantId: string, role: TenantContext["role"] = "owner"): TenantContext => ({ tenantId, userId: "u", role, session: {} as never });

const branchesOf = (tenantId: string) => db.select().from(schema.branches).where(eq(schema.branches.tenantId, tenantId));

async function newTenant(slug: string, templateIds: string[]) {
  const id = await tenants.onboardTenant({
    tenant: { name: slug, slug, currency: "USD", timezone: "UTC" },
    owner: { name: "Owner", username: `owner-${slug}`, password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
    branch: { name: `HQ ${slug}`, addressLine: "1 Main St", offeredTemplateIds: [] },
    services: templateIds.map((templateId) => ({ templateId, priceCents: 1_000, durationMinutes: 30 })),
  });
  const services = await db.select().from(schema.services).where(eq(schema.services.tenantId, id));
  return { id, serviceByTemplate: new Map(services.map((s) => [s.templateId, s.id])) };
}

beforeAll(async () => {
  tenants = await import("@/server/tenants/service");
  branches = await import("@/server/branches/service");
  schema = await import("@/db/schema");
  db = (await import("@/db/client")).getDb();
  haircut = (await tenants.createServiceTemplate({ name: "Haircut", category: "Hair", audience: "unisex", defaultDurationMinutes: 45, defaultPriceCents: 5_500 })).id;
  kids = (await tenants.createServiceTemplate({ name: "Kids Haircut", category: "Hair", audience: "kids", defaultDurationMinutes: 30, defaultPriceCents: 3_000 })).id;
  facial = (await tenants.createServiceTemplate({ name: "Facial", category: "Skin", audience: "women", defaultDurationMinutes: 60, defaultPriceCents: 8_000 })).id;
});

describe("service audience", () => {
  it("is copied from the template onto tenant services and surfaced to branches", async () => {
    const t = await newTenant("audience", [haircut, kids, facial]);
    const detail = await tenants.getTenantDetail(t.id);
    expect(Object.fromEntries(detail.services.map((s) => [s.name, s.audience]))).toEqual({ Haircut: "unisex", "Kids Haircut": "kids", Facial: "women" });

    const options = await branches.listServiceOptions(t.id);
    expect(options.find((o) => o.name === "Kids Haircut")?.audience).toBe("kids");
  });
});

describe("onboarding: first branch offerings", () => {
  it("offers only the chosen subset of the picked services", async () => {
    const id = await tenants.onboardTenant({
      tenant: { name: "Subset", slug: "subset", currency: "USD", timezone: "UTC" },
      owner: { name: "Owner", username: "owner-subset", password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
      branch: { name: "HQ subset", addressLine: "1 Main St", offeredTemplateIds: [haircut] },
      services: [haircut, kids].map((templateId) => ({ templateId, priceCents: 1_000, durationMinutes: 30 })),
    });
    const [branch] = await branchesOf(id);
    const view = await branches.getBranchServices(ctxFor(id), branch!.id);
    expect(view.options).toHaveLength(2);
    expect(view.options.filter((o) => view.offeredIds.includes(o.id)).map((o) => o.name)).toEqual(["Haircut"]);
  });
});

describe("branch service offerings", () => {
  it("creates a branch with chosen services and lets the owner change them", async () => {
    const t = await newTenant("offer", [haircut, kids, facial]);
    const [h, k, f] = [haircut, kids, facial].map((tpl) => t.serviceByTemplate.get(tpl)!);

    const branch = await branches.createBranch(ctxFor(t.id), { name: "Second", addressLine: "2 Side St", status: "active", serviceIds: [h!, k!, k!] });
    let view = await branches.getBranchServices(ctxFor(t.id), branch.id);
    expect([...view.offeredIds].sort()).toEqual([h!, k!].sort()); // duplicate id collapsed

    await branches.setBranchServices(ctxFor(t.id), branch.id, [k!, f!]);
    view = await branches.getBranchServices(ctxFor(t.id), branch.id);
    expect([...view.offeredIds].sort()).toEqual([k!, f!].sort());

    await branches.setBranchServices(ctxFor(t.id), branch.id, []);
    expect((await branches.getBranchServices(ctxFor(t.id), branch.id)).offeredIds).toEqual([]);
  });

  it("rejects services from another tenant or inactive services", async () => {
    const a = await newTenant("tenant-a", [haircut, facial]);
    const b = await newTenant("tenant-b", [haircut]);
    const foreign = b.serviceByTemplate.get(haircut)!;

    await expect(branches.createBranch(ctxFor(a.id), { name: "X", addressLine: "3 Rd", status: "active", serviceIds: [foreign] })).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { serviceIds: expect.any(Array) },
    });

    const [hq] = await branchesOf(a.id);
    await expect(branches.setBranchServices(ctxFor(a.id), hq!.id, [foreign])).rejects.toMatchObject({ code: "VALIDATION" });

    const own = a.serviceByTemplate.get(facial)!;
    await tenants.updateTenantService({ tenantId: a.id, serviceId: own, priceCents: 1_000, durationMinutes: 30, active: false });
    await expect(branches.setBranchServices(ctxFor(a.id), hq!.id, [own])).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("only lets owners and managers change offerings, and 404s unknown branches", async () => {
    const t = await newTenant("perms", [haircut]);
    const [hq] = await branchesOf(t.id);
    await expect(branches.setBranchServices(ctxFor(t.id, "staff"), hq!.id, [])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(branches.setBranchServices(ctxFor(t.id), "7d3c9f62-1d0a-4e1b-9a55-ffffffffffff", [])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not let a branch of one tenant be edited by another", async () => {
    const a = await newTenant("own-a", [haircut]);
    const b = await newTenant("own-b", [haircut]);
    const [hqA] = await branchesOf(a.id);
    await expect(branches.setBranchServices(ctxFor(b.id), hqA!.id, [])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
