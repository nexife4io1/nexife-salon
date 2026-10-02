import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { isDatabaseConfigured, withTenant } from "@/db/client";
import { branches } from "@/db/schema";
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
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .insert(branches)
      .values({ tenantId, ...input })
      .returning(columns),
  );
  return row!;
}
