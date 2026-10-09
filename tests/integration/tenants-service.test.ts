import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/lib/password";

// Real Postgres semantics without a server: PGlite runs every migration, and `@/db/client`
// is swapped for a Drizzle client on top of it. tenants.service -> repository -> SQL.
vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());

type Service = typeof import("@/server/tenants/service");
let service: Service;
let db: ReturnType<typeof import("@/db/client").getDb>;
let schema: typeof import("@/db/schema");
let haircutId: string;
let facialId: string;

beforeAll(async () => {
  service = await import("@/server/tenants/service");
  db = (await import("@/db/client")).getDb();
  schema = await import("@/db/schema");
  haircutId = (await service.createServiceTemplate({ name: "Haircut", category: "Hair", audience: "unisex", defaultDurationMinutes: 45, defaultPriceCents: 5_500 })).id;
  facialId = (await service.createServiceTemplate({ name: "Facial", category: "Skin", audience: "women", defaultDurationMinutes: 60, defaultPriceCents: 8_000 })).id;
});

const input = (slug: string, overrides: { username?: string; services?: Array<{ templateId: string; priceCents: number; durationMinutes: number }> } = {}) => ({
  tenant: { name: `Tenant ${slug}`, slug, currency: "EUR", timezone: "Europe/Paris" },
  owner: { name: "Olivia Owner", username: overrides.username ?? `owner-${slug}`, password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
  branch: { name: `Branch ${slug}`, addressLine: "1 Rue de Test", city: "Paris", phone: undefined, offeredTemplateIds: [] as string[] },
  services: overrides.services ?? [
    { templateId: haircutId, priceCents: 6_000, durationMinutes: 40 },
    { templateId: facialId, priceCents: 8_000, durationMinutes: 60 },
  ],
});

async function footprint(slug: string, username: string, branchName: string) {
  const [tenantRows, userRows, branchRows] = await Promise.all([
    db.select().from(schema.tenants).where(eq(schema.tenants.slug, slug)),
    db.select().from(schema.users).where(eq(schema.users.username, username)),
    db.select().from(schema.branches).where(eq(schema.branches.name, branchName)),
  ]);
  return { tenants: tenantRows.length, users: userRows.length, branches: branchRows.length };
}

async function expectValidation(promise: Promise<unknown>, key: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toMatchObject({ name: "AppError", code: "VALIDATION" });
  expect((error as { fieldErrors: Record<string, string[]> }).fieldErrors).toHaveProperty([key]);
}

describe("tenants service: onboarding", () => {
  it("creates the tenant, owner, branch and services together", async () => {
    const id = await service.onboardTenant(input("glow"));
    const detail = await service.getTenantDetail(id);

    expect(detail).toMatchObject({ slug: "glow", currency: "EUR", timezone: "Europe/Paris" });
    expect(detail.owners).toHaveLength(1);
    expect(detail.owners[0]).toMatchObject({ name: "Olivia Owner", username: "owner-glow", role: "owner" });
    expect(detail.branches).toHaveLength(1);
    expect(detail.branches[0]).toMatchObject({ name: "Branch glow", status: "active" });
    expect(detail.services.map((s) => ({ name: s.name, category: s.category, priceCents: s.priceCents, durationMinutes: s.durationMinutes, templateId: s.templateId }))).toEqual(
      expect.arrayContaining([
        { name: "Haircut", category: "Hair", priceCents: 6_000, durationMinutes: 40, templateId: haircutId },
        { name: "Facial", category: "Skin", priceCents: 8_000, durationMinutes: 60, templateId: facialId },
      ]),
    );
    expect(detail.services).toHaveLength(2);
  });

  it("stores a hashed password and never exposes it", async () => {
    const id = await service.onboardTenant(input("hashed"));
    const [row] = await db.select().from(schema.users).where(eq(schema.users.tenantId, id));
    expect(row!.passwordHash).toMatch(/^scrypt\$/);
    expect(await verifyPassword("correct-horse-battery", row!.passwordHash)).toBe(true);

    const detail = await service.getTenantDetail(id);
    expect(JSON.stringify(detail)).not.toMatch(/scrypt|passwordHash|password/i);
  });

  it("lists summaries with counts", async () => {
    const id = await service.onboardTenant(input("counted"));
    const summary = (await service.listTenantSummaries()).find((t) => t.id === id);
    expect(summary).toMatchObject({ slug: "counted", branchCount: 1, userCount: 1, serviceCount: 2 });
    expect(Number.isNaN(Date.parse(summary!.createdAt))).toBe(false);
  });

  it("rejects a duplicate slug as a field error on tenant.slug", async () => {
    await service.onboardTenant(input("dup-slug"));
    await expectValidation(service.onboardTenant(input("dup-slug", { username: "someone-else" })), "tenant.slug");
    expect((await footprint("dup-slug", "someone-else", "Branch dup-slug")).users).toBe(0);
  });

  it("rejects a duplicate username and rolls back the tenant it had already inserted", async () => {
    await service.onboardTenant(input("first", { username: "shared-name" }));
    await expectValidation(service.onboardTenant(input("second", { username: "shared-name" })), "owner.username");
    expect(await footprint("second", "unused", "Branch second")).toEqual({ tenants: 0, users: 0, branches: 0 });
  });

  it("rolls everything back when a later step fails (tenant, owner and branch were already inserted)", async () => {
    const missingTemplate = "c7e1a5d0-3b2f-4a6e-9c1d-0000000000ff";
    await expectValidation(
      service.onboardTenant(input("partial", { services: [{ templateId: haircutId, priceCents: 1, durationMinutes: 30 }, { templateId: missingTemplate, priceCents: 1, durationMinutes: 30 }] })),
      "services.1.templateId",
    );
    expect(await footprint("partial", "owner-partial", "Branch partial")).toEqual({ tenants: 0, users: 0, branches: 0 });
    expect(await db.select().from(schema.services).where(eq(schema.services.templateId, haircutId))).not.toHaveLength(0); // other tenants' rows untouched
  });

  it("rejects inactive templates", async () => {
    const retired = (await service.createServiceTemplate({ name: "Retired", category: null, audience: "kids", defaultDurationMinutes: 30, defaultPriceCents: 1_000 })).id;
    await service.setServiceTemplateActive(retired, false);
    await expectValidation(service.onboardTenant(input("retired", { services: [{ templateId: retired, priceCents: 1, durationMinutes: 30 }] })), "services.0.templateId");
  });
});

describe("tenants service: service associations", () => {
  it("adds new templates, rejects ones already associated, and edits a tenant service", async () => {
    const id = await service.onboardTenant(input("assoc", { services: [{ templateId: haircutId, priceCents: 5_000, durationMinutes: 30 }] }));

    await service.addTenantServices({ tenantId: id, services: [{ templateId: facialId, priceCents: 9_000, durationMinutes: 50 }] });
    const afterAdd = await service.getTenantDetail(id);
    expect(afterAdd.services.map((s) => s.name).sort()).toEqual(["Facial", "Haircut"]);

    await expectValidation(service.addTenantServices({ tenantId: id, services: [{ templateId: facialId, priceCents: 1, durationMinutes: 30 }] }), "services");

    const haircut = afterAdd.services.find((s) => s.name === "Haircut")!;
    const updated = await service.updateTenantService({ tenantId: id, serviceId: haircut.id, priceCents: 5_250, durationMinutes: 35, active: false });
    expect(updated).toMatchObject({ priceCents: 5_250, durationMinutes: 35, active: false });
  });

  it("does not let one tenant edit another tenant's service", async () => {
    const a = await service.getTenantDetail(await service.onboardTenant(input("iso-a")));
    const b = await service.onboardTenant(input("iso-b"));
    await expect(
      service.updateTenantService({ tenantId: b, serviceId: a.services[0]!.id, priceCents: 1, durationMinutes: 30, active: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND for unknown tenants", async () => {
    const unknown = "7d3c9f62-1d0a-4e1b-9a55-ffffffffffff";
    await expect(service.getTenantDetail(unknown)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.addTenantServices({ tenantId: unknown, services: [{ templateId: haircutId, priceCents: 1, durationMinutes: 30 }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("tenants service: service templates", () => {
  it("creates, updates and toggles templates", async () => {
    const created = await service.createServiceTemplate({ name: "Mani", category: null, audience: "kids", defaultDurationMinutes: 40, defaultPriceCents: 3_000 });
    expect(created).toMatchObject({ name: "Mani", active: true });

    const updated = await service.updateServiceTemplate({ id: created.id, name: "Manicure", category: "Nails", audience: "women", defaultDurationMinutes: 45, defaultPriceCents: 3_500 });
    expect(updated).toMatchObject({ name: "Manicure", category: "Nails", defaultPriceCents: 3_500 });

    expect((await service.setServiceTemplateActive(created.id, false)).active).toBe(false);
    expect((await service.listServiceTemplates()).find((t) => t.id === created.id)?.active).toBe(false);

    await expect(service.setServiceTemplateActive("c7e1a5d0-3b2f-4a6e-9c1d-0000000000fe", true)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
