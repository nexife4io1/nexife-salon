import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { isDatabaseConfigured, withTenant } from "@/db/client";
import { payments } from "@/db/schema";
import { fixtureBranchActivity, fixtureBranches } from "@/db/seed/fixtures";
import type { Payment } from "./schema";

export async function sumByBranchBetween(tenantId: string, start: Date, end: Date): Promise<Map<string, number>> {
  if (!isDatabaseConfigured()) {
    return new Map(
      fixtureBranches.filter((b) => b.tenantId === tenantId).map((b) => [b.id, fixtureBranchActivity[b.id]?.revenueTodayCents ?? 0]),
    );
  }
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({ branchId: payments.branchId, total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), gte(payments.paidAt, start), lt(payments.paidAt, end)))
      .groupBy(payments.branchId),
  );
  return new Map(rows.map((r) => [r.branchId, r.total]));
}

export async function listRecent(tenantId: string, limit = 20): Promise<Payment[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, (tx) =>
    tx
      .select({
        id: payments.id,
        branchId: payments.branchId,
        appointmentId: payments.appointmentId,
        amountCents: payments.amountCents,
        method: payments.method,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.paidAt))
      .limit(limit),
  );
}
