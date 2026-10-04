import "server-only";
import { and, asc, count, eq, gte, lt, ne } from "drizzle-orm";
import { isDatabaseConfigured, withTenant } from "@/db/client";
import { appointments, customers, services, staff } from "@/db/schema";
import { fixtureBranchActivity, fixtureBranches } from "@/db/seed/fixtures";
import type { Appointment } from "./schema";

export async function countByBranchBetween(tenantId: string, start: Date, end: Date): Promise<Map<string, number>> {
  if (!isDatabaseConfigured()) {
    return new Map(
      fixtureBranches.filter((b) => b.tenantId === tenantId).map((b) => [b.id, fixtureBranchActivity[b.id]?.appointmentsToday ?? 0]),
    );
  }
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({ branchId: appointments.branchId, total: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.startsAt, start),
          lt(appointments.startsAt, end),
          ne(appointments.status, "cancelled"),
        ),
      )
      .groupBy(appointments.branchId),
  );
  return new Map(rows.map((r) => [r.branchId, r.total]));
}

export async function listBetween(tenantId: string, start: Date, end: Date): Promise<Appointment[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, (tx) =>
    tx
      .select({
        id: appointments.id,
        branchId: appointments.branchId,
        customerName: customers.name,
        serviceName: services.name,
        staffName: staff.name,
        startsAt: appointments.startsAt,
        type: appointments.type,
        status: appointments.status,
      })
      .from(appointments)
      .leftJoin(customers, eq(customers.id, appointments.customerId))
      .leftJoin(services, eq(services.id, appointments.serviceId))
      .leftJoin(staff, eq(staff.id, appointments.staffId))
      .where(and(eq(appointments.tenantId, tenantId), gte(appointments.startsAt, start), lt(appointments.startsAt, end)))
      .orderBy(asc(appointments.startsAt)),
  );
}
