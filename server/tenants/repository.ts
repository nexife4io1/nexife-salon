import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { tenants, users } from "@/db/schema";
import { fixtureTenants, fixtureUsers } from "@/db/seed/fixtures";
import type { Tenant, TenantUser } from "./schema";

export async function findTenantById(tenantId: string): Promise<Tenant | null> {
  if (!isDatabaseConfigured()) return fixtureTenants.find((t) => t.id === tenantId) ?? null;
  const [row] = await getDb()
    .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, currency: tenants.currency, timezone: tenants.timezone })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row ?? null;
}

export async function listTenants(): Promise<Tenant[]> {
  if (!isDatabaseConfigured()) return [...fixtureTenants];
  return getDb()
    .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, currency: tenants.currency, timezone: tenants.timezone })
    .from(tenants)
    .orderBy(asc(tenants.name));
}

export async function listUsersByTenant(tenantId: string): Promise<TenantUser[]> {
  if (!isDatabaseConfigured()) {
    return fixtureUsers.filter((u) => u.tenantId === tenantId).map((u) => ({ ...u, menus: [] }));
  }
  return getDb()
    .select({ id: users.id, name: users.name, username: users.username, role: users.role, menus: users.menus })
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .orderBy(asc(users.name));
}
