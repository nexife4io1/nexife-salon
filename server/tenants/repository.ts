import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured, withTenant, type Executor } from "@/db/client";
import { branchServices, branches, serviceTemplates, services, tenants, users } from "@/db/schema";
import {
  fixtureBranches,
  fixtureServiceTemplates,
  fixtureServices,
  fixtureTenantCreatedAt,
  fixtureTenants,
  fixtureUsers,
} from "@/db/seed/fixtures";
import { AppError } from "@/server/shared/errors";
import type {
  CreateServiceTemplateInput,
  OnboardTenantInput,
  ServiceTemplate,
  Tenant,
  TenantDetail,
  TenantService,
  TenantServiceSelection,
  TenantSummary,
  TenantUser,
  UpdateServiceTemplateInput,
  UpdateTenantServiceInput,
} from "./schema";

export function dataSource(): "database" | "demo" {
  return isDatabaseConfigured() ? "database" : "demo";
}

const tenantColumns = { id: tenants.id, slug: tenants.slug, name: tenants.name, currency: tenants.currency, timezone: tenants.timezone };

const templateColumns = {
  id: serviceTemplates.id,
  name: serviceTemplates.name,
  category: serviceTemplates.category,
  audience: serviceTemplates.audience,
  defaultDurationMinutes: serviceTemplates.defaultDurationMinutes,
  defaultPriceCents: serviceTemplates.defaultPriceCents,
  active: serviceTemplates.active,
};

const serviceColumns = {
  id: services.id,
  templateId: services.templateId,
  name: services.name,
  category: services.category,
  audience: services.audience,
  durationMinutes: services.durationMinutes,
  priceCents: services.priceCents,
  active: services.active,
};

// Never select users.passwordHash into anything that leaves this file.
const userColumns = { id: users.id, name: users.name, username: users.username, role: users.role, menus: users.menus };

/** Postgres unique-violation constraint name, if `error` (or its cause: Drizzle wraps driver errors) is a 23505. */
function uniqueViolation(error: unknown): string | null {
  for (let e: unknown = error, depth = 0; e && typeof e === "object" && depth < 4; e = (e as { cause?: unknown }).cause, depth++) {
    const { code, constraint_name, constraint } = e as { code?: string; constraint_name?: string; constraint?: string };
    if (code === "23505") return constraint_name ?? constraint ?? "";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export async function findTenantById(tenantId: string): Promise<Tenant | null> {
  if (!isDatabaseConfigured()) return fixtureTenants.find((t) => t.id === tenantId) ?? null;
  const [row] = await getDb().select(tenantColumns).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return row ?? null;
}

export async function listTenants(): Promise<Tenant[]> {
  if (!isDatabaseConfigured()) return [...fixtureTenants];
  return getDb().select(tenantColumns).from(tenants).orderBy(asc(tenants.name));
}

export async function listUsersByTenant(tenantId: string): Promise<TenantUser[]> {
  if (!isDatabaseConfigured()) {
    return fixtureUsers.filter((u) => u.tenantId === tenantId).map((u) => ({ ...u, menus: [] }));
  }
  return getDb().select(userColumns).from(users).where(eq(users.tenantId, tenantId)).orderBy(asc(users.name));
}

/**
 * Platform directory with per-tenant counts.
 * TODO(step 1, salon_app role): branches/services have RLS, so once the app stops connecting as the
 * table owner these cross-tenant counts read 0 — switch to per-tenant withTenant() or a platform policy.
 */
export async function listTenantSummaries(): Promise<TenantSummary[]> {
  if (!isDatabaseConfigured()) {
    return fixtureTenants.map((t) => ({
      ...t,
      createdAt: fixtureTenantCreatedAt,
      branchCount: fixtureBranches.filter((b) => b.tenantId === t.id).length,
      userCount: fixtureUsers.filter((u) => u.tenantId === t.id).length,
      serviceCount: fixtureServices.filter((s) => s.tenantId === t.id).length,
    }));
  }
  const db = getDb();
  const countBy = (tenantId: typeof branches.tenantId | typeof users.tenantId | typeof services.tenantId, table: typeof branches | typeof users | typeof services) =>
    db.select({ tenantId, total: count() }).from(table).groupBy(tenantId);
  const [rows, branchCounts, userCounts, serviceCounts] = await Promise.all([
    db.select({ ...tenantColumns, createdAt: tenants.createdAt }).from(tenants).orderBy(asc(tenants.name)),
    countBy(branches.tenantId, branches),
    countBy(users.tenantId, users),
    countBy(services.tenantId, services),
  ]);
  const toMap = (counts: Array<{ tenantId: string | null; total: number }>) => new Map(counts.map((c) => [c.tenantId, c.total]));
  const [branchBy, userBy, serviceBy] = [toMap(branchCounts), toMap(userCounts), toMap(serviceCounts)];
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    branchCount: branchBy.get(r.id) ?? 0,
    userCount: userBy.get(r.id) ?? 0,
    serviceCount: serviceBy.get(r.id) ?? 0,
  }));
}

export async function findTenantDetail(tenantId: string): Promise<TenantDetail | null> {
  if (!isDatabaseConfigured()) {
    const tenant = fixtureTenants.find((t) => t.id === tenantId);
    if (!tenant) return null;
    return {
      ...tenant,
      createdAt: fixtureTenantCreatedAt,
      owners: (await listUsersByTenant(tenantId)).filter((u) => u.role === "owner"),
      branches: fixtureBranches.filter((b) => b.tenantId === tenantId).map((b) => ({ ...b, phone: null })),
      services: await listTenantServices(tenantId),
    };
  }
  const [row] = await getDb()
    .select({ ...tenantColumns, createdAt: tenants.createdAt })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!row) return null;

  const [owners, tenantBranches, tenantServices] = await Promise.all([
    getDb()
      .select(userColumns)
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "owner")))
      .orderBy(asc(users.name)),
    withTenant(tenantId, (tx) =>
      tx
        .select({ id: branches.id, name: branches.name, addressLine: branches.addressLine, city: branches.city, phone: branches.phone, status: branches.status })
        .from(branches)
        .where(eq(branches.tenantId, tenantId))
        .orderBy(asc(branches.createdAt), asc(branches.name)),
    ),
    listTenantServices(tenantId),
  ]);
  return { ...row, createdAt: row.createdAt.toISOString(), owners, branches: tenantBranches, services: tenantServices };
}

export type OnboardTenantRecord = {
  tenant: OnboardTenantInput["tenant"];
  owner: { name: string; username: string; passwordHash: string };
  branch: OnboardTenantInput["branch"];
  services: TenantServiceSelection[];
};

/**
 * Creates tenant + first owner + first branch + services atomically. This repository is allowed to
 * write branches/services (normally owned by other domains) so a failure can never leave a half-created tenant.
 * Returns the new tenant id. Throws DatabaseNotConfiguredError in demo mode.
 */
export async function onboardTenant(input: OnboardTenantRecord): Promise<string> {
  try {
    return await getDb().transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values(input.tenant).returning({ id: tenants.id });
      const tenantId = tenant!.id;
      // branches/services are RLS-protected: scope this transaction to the new tenant.
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);

      await tx.insert(users).values({ tenantId, role: "owner", ...input.owner });
      const { offeredTemplateIds, ...branchFields } = input.branch;
      const [branch] = await tx.insert(branches).values({ tenantId, ...branchFields }).returning({ id: branches.id });
      const created = await insertServicesFromTemplates(tx, tenantId, input.services);
      const offered = new Set(offeredTemplateIds);
      const offeredServices = created.filter((s) => s.templateId && offered.has(s.templateId));
      if (offeredServices.length) {
        await tx.insert(branchServices).values(offeredServices.map((s) => ({ tenantId, branchId: branch!.id, serviceId: s.id })));
      }
      return tenantId;
    });
  } catch (error) {
    const constraint = uniqueViolation(error);
    if (constraint === "tenants_slug_unique") {
      throw new AppError("VALIDATION", "Please fix the highlighted fields.", { "tenant.slug": ["That slug is already taken"] });
    }
    if (constraint === "users_username_uq") {
      throw new AppError("VALIDATION", "Please fix the highlighted fields.", { "owner.username": ["That username is already taken"] });
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Service templates (platform-level, no tenant scope)
// ---------------------------------------------------------------------------

export async function listServiceTemplates(): Promise<ServiceTemplate[]> {
  if (!isDatabaseConfigured()) return fixtureServiceTemplates.map((t) => ({ ...t, active: true }));
  return getDb().select(templateColumns).from(serviceTemplates).orderBy(asc(serviceTemplates.category), asc(serviceTemplates.name));
}

export async function createServiceTemplate(input: CreateServiceTemplateInput): Promise<ServiceTemplate> {
  const [row] = await getDb().insert(serviceTemplates).values(input).returning(templateColumns);
  return row!;
}

export async function updateServiceTemplate({ id, ...patch }: UpdateServiceTemplateInput): Promise<ServiceTemplate | null> {
  const [row] = await getDb().update(serviceTemplates).set(patch).where(eq(serviceTemplates.id, id)).returning(templateColumns);
  return row ?? null;
}

export async function setServiceTemplateActive(id: string, active: boolean): Promise<ServiceTemplate | null> {
  const [row] = await getDb().update(serviceTemplates).set({ active }).where(eq(serviceTemplates.id, id)).returning(templateColumns);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// A tenant's services (tenant-scoped, through withTenant)
// ---------------------------------------------------------------------------

export async function listTenantServices(tenantId: string): Promise<TenantService[]> {
  if (!isDatabaseConfigured()) {
    return fixtureServices
      .filter((s) => s.tenantId === tenantId)
      .map((s, i) => ({ id: `fixture-${i}`, templateId: null, name: s.name, category: s.category, audience: s.audience, durationMinutes: s.durationMinutes, priceCents: s.priceCents, active: true }));
  }
  return withTenant(tenantId, (tx) =>
    tx.select(serviceColumns).from(services).where(eq(services.tenantId, tenantId)).orderBy(asc(services.category), asc(services.name)),
  );
}

/** Copy name/category from each active template into a tenant-owned service. Runs inside the caller's transaction. */
async function insertServicesFromTemplates(
  tx: Executor,
  tenantId: string,
  selections: TenantServiceSelection[],
): Promise<Array<{ id: string; templateId: string | null }>> {
  const templates = await tx
    .select({ id: serviceTemplates.id, name: serviceTemplates.name, category: serviceTemplates.category, audience: serviceTemplates.audience })
    .from(serviceTemplates)
    .where(and(inArray(serviceTemplates.id, selections.map((s) => s.templateId)), eq(serviceTemplates.active, true)));
  const byId = new Map(templates.map((t) => [t.id, t]));

  const missing = selections.map((s, i) => [s, i] as const).filter(([s]) => !byId.has(s.templateId));
  if (missing.length) {
    throw new AppError(
      "VALIDATION",
      "Please fix the highlighted fields.",
      Object.fromEntries(missing.map(([, i]) => [`services.${i}.templateId`, ["This service is no longer available"]])),
    );
  }

  return tx
    .insert(services)
    .values(
      selections.map((s) => {
        const template = byId.get(s.templateId)!;
        return {
          tenantId,
          templateId: s.templateId,
          name: template.name,
          category: template.category,
          audience: template.audience,
          priceCents: s.priceCents,
          durationMinutes: s.durationMinutes,
        };
      }),
    )
    .returning({ id: services.id, templateId: services.templateId });
}

/** Associate templates the tenant doesn't have yet. Already-associated templates are rejected as a validation error. */
export async function addTenantServices(tenantId: string, selections: TenantServiceSelection[]): Promise<void> {
  try {
    await withTenant(tenantId, (tx) => insertServicesFromTemplates(tx, tenantId, selections));
  } catch (error) {
    if (uniqueViolation(error) === "services_tenant_template_uq") {
      throw new AppError("VALIDATION", "Please fix the highlighted fields.", { services: ["One of these services is already associated with this tenant"] });
    }
    throw error;
  }
}

export async function updateTenantService(input: UpdateTenantServiceInput): Promise<TenantService | null> {
  const { tenantId, serviceId, ...patch } = input;
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .update(services)
      .set(patch)
      .where(and(eq(services.tenantId, tenantId), eq(services.id, serviceId)))
      .returning(serviceColumns),
  );
  return row ?? null;
}
