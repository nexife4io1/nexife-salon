import "server-only";
import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { isDatabaseConfigured, withTenant } from "@/db/client";
import { services, staff } from "@/db/schema";
import { fixtureBranchActivity, fixtureBranches, fixtureServices } from "@/db/seed/fixtures";
import type { SalonService, StaffMember } from "./schema";

export async function countActiveByBranch(tenantId: string): Promise<Map<string, number>> {
  if (!isDatabaseConfigured()) {
    return new Map(
      fixtureBranches.filter((b) => b.tenantId === tenantId).map((b) => [b.id, fixtureBranchActivity[b.id]?.staffCount ?? 0]),
    );
  }
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({ branchId: staff.branchId, total: count() })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.active, true), isNotNull(staff.branchId)))
      .groupBy(staff.branchId),
  );
  return new Map(rows.map((r) => [r.branchId!, r.total]));
}

export async function listStaff(tenantId: string): Promise<StaffMember[]> {
  // Fixture mode only carries per-branch counts, not individual staff rows.
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, (tx) =>
    tx
      .select({ id: staff.id, branchId: staff.branchId, name: staff.name, initials: staff.initials, title: staff.title, active: staff.active })
      .from(staff)
      .where(eq(staff.tenantId, tenantId))
      .orderBy(asc(staff.name)),
  );
}

export async function listServices(tenantId: string): Promise<SalonService[]> {
  if (!isDatabaseConfigured()) {
    return fixtureServices
      .filter((s) => s.tenantId === tenantId)
      .map((s, i) => ({ id: `fixture-${i}`, name: s.name, category: s.category, audience: s.audience, durationMinutes: s.durationMinutes, priceCents: s.priceCents }));
  }
  return withTenant(tenantId, (tx) =>
    tx
      .select({ id: services.id, name: services.name, category: services.category, audience: services.audience, durationMinutes: services.durationMinutes, priceCents: services.priceCents })
      .from(services)
      .where(and(eq(services.tenantId, tenantId), eq(services.active, true)))
      .orderBy(asc(services.name)),
  );
}
