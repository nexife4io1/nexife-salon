import { eq } from "drizzle-orm";
import type { TenantContext } from "@/server/shared/context";

/**
 * Shared setup for the appointment integration suites. The suite must mock the database first:
 *   vi.mock("@/db/client", async () => (await import("../support/pglite-db")).createTestDbModule());
 */
export const NOW = new Date("2026-10-16T08:00:00Z");

export const ctxFor = (tenantId: string, role: TenantContext["role"] = "owner"): TenantContext => ({ tenantId, userId: "user-1", role, session: {} as never });

export async function loadFixture(serviceNames: string[] = ["Haircut", "Color", "Perm", "Facial", "Massage", "Manicure", "Pedicure", "Wax", "Threading", "Spa", "Shave", "Beard"]) {
  const tenants = await import("@/server/tenants/service");
  const staffService = await import("@/server/staff/service");
  const staffSchema = await import("@/server/staff/schema");
  const appts = await import("@/server/appointments/service");
  const schema = await import("@/server/appointments/schema");
  const tables = await import("@/db/schema");
  const db = (await import("@/db/client")).getDb();

  const templates: { id: string; name: string }[] = [];
  for (const name of serviceNames) {
    const tpl = await tenants.createServiceTemplate({ name, category: "Hair", audience: "unisex", defaultDurationMinutes: 30, defaultPriceCents: 5_000 });
    templates.push({ id: tpl.id, name });
  }

  /** A tenant with one branch that offers every service except the last one ("not offered"). */
  async function newTenant(slug: string) {
    const offered = templates.slice(0, -1);
    const id = await tenants.onboardTenant({
      tenant: { name: `Salon ${slug}`, slug, currency: "USD", timezone: "UTC" },
      owner: { name: "Owner", username: `owner-${slug}`, password: "correct-horse-battery", confirmPassword: "correct-horse-battery" },
      branch: { name: `HQ ${slug}`, addressLine: "1 Main St", offeredTemplateIds: offered.map((t) => t.id) },
      services: templates.map((t) => ({ templateId: t.id, priceCents: 1_000, durationMinutes: 30 })),
    });
    const [branch] = await db.select().from(tables.branches).where(eq(tables.branches.tenantId, id));
    const catalog = await db.select().from(tables.services).where(eq(tables.services.tenantId, id));
    const service = (name: string) => catalog.find((s) => s.name === name)!.id;
    const [customer] = await db.insert(tables.customers).values({ tenantId: id, name: "Cara Customer", phone: "+15550001111", phoneKey: `k-${slug}` }).returning();
    const ctx = ctxFor(id);
    const member = async (name: string, over: { branchId?: string; serviceIds?: string[] } = {}) =>
      (await staffService.createStaff(ctx, staffSchema.staffInputSchema.parse({ name, branchId: over.branchId ?? branch!.id, serviceIds: over.serviceIds ?? [] }))).id;
    return { id, ctx, branchId: branch!.id, service, notOffered: templates.at(-1)!.name, customerId: customer!.id, member };
  }
  type T = Awaited<ReturnType<typeof newTenant>>;

  const book = (t: T, over: Record<string, string | string[]> = {}) =>
    appts.book(
      t.ctx,
      schema.bookAppointmentInputSchema.parse({ branchId: t.branchId, serviceId: t.service("Haircut"), customerId: t.customerId, date: "2026-10-20", time: "10:00", ...over }),
      NOW,
    );

  const toStatus = async (t: T, id: string, ...statuses: ("checked_in" | "in_service" | "completed")[]) => {
    for (const status of statuses) await appts.changeStatus(t.ctx, { id, status });
  };

  const lines = async (t: T, id: string) => (await appts.findAppointment(t.id, id))!.services;

  return { appts, schema, tables, db, tenants, staffService, newTenant, book, toStatus, lines, templates };
}
export type Fixture = Awaited<ReturnType<typeof loadFixture>>;
export type FixtureTenant = Awaited<ReturnType<Fixture["newTenant"]>>;
