import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { isDatabaseConfigured, withTenant } from "@/db/client";
import { branchServices, branches } from "@/db/schema";
import { fixtureBranches } from "@/db/seed/fixtures";
import type { Branch, CreateBranchInput } from "./schema";

const columns = {
  id: branches.id,
  name: branches.name,
  addressLine: branches.addressLine,
  city: branches.city,
  phone: branches.phone,
  status: branches.status,
};

export function dataSource(): "database" | "demo" {
  return isDatabaseConfigured() ? "database" : "demo";
}

export async function listByTenant(tenantId: string): Promise<Branch[]> {
  if (!isDatabaseConfigured()) {
    return fixtureBranches.filter((b) => b.tenantId === tenantId).map((b) => ({ ...b, phone: null }));
  }
  return withTenant(tenantId, (tx) =>
    tx.select(columns).from(branches).where(eq(branches.tenantId, tenantId)).orderBy(asc(branches.createdAt), asc(branches.name)),
  );
}

export async function findById(tenantId: string, branchId: string): Promise<Branch | null> {
  if (!isDatabaseConfigured()) {
    const b = fixtureBranches.find((f) => f.tenantId === tenantId && f.id === branchId);
    return b ? { ...b, phone: null } : null;
  }
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select(columns)
      .from(branches)
      .where(and(eq(branches.tenantId, tenantId), eq(branches.id, branchId)))
      .limit(1),
  );
  return row ?? null;
}

/** Throws DatabaseNotConfiguredError in demo mode — writes always need a real DB. */
export async function insert(tenantId: string, input: CreateBranchInput): Promise<Branch> {
  const { serviceIds, ...fields } = input;
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .insert(branches)
      .values({ tenantId, ...fields })
      .returning(columns);
    if (serviceIds.length) {
      await tx.insert(branchServices).values(serviceIds.map((serviceId) => ({ tenantId, branchId: row!.id, serviceId })));
    }
    return row!;
  });
}

/** Ids of the services a branch offers. Demo mode has no offerings table, so the service layer treats it as "all". */
export async function listOfferedServiceIds(tenantId: string, branchId: string): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({ serviceId: branchServices.serviceId })
      .from(branchServices)
      .where(and(eq(branchServices.tenantId, tenantId), eq(branchServices.branchId, branchId))),
  );
  return rows.map((r) => r.serviceId);
}

/** Replace a branch's offerings with exactly `serviceIds`. */
export async function replaceOfferedServices(tenantId: string, branchId: string, serviceIds: string[]): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    const where = and(eq(branchServices.tenantId, tenantId), eq(branchServices.branchId, branchId));
    const existing = new Set((await tx.select({ serviceId: branchServices.serviceId }).from(branchServices).where(where)).map((r) => r.serviceId));
    const wanted = new Set(serviceIds);
    const removed = [...existing].filter((id) => !wanted.has(id));
    const added = [...wanted].filter((id) => !existing.has(id));
    if (removed.length) await tx.delete(branchServices).where(and(where, inArray(branchServices.serviceId, removed)));
    if (added.length) await tx.insert(branchServices).values(added.map((serviceId) => ({ tenantId, branchId, serviceId })));
  });
}
