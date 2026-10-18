import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, ne, sql, type SQL } from "drizzle-orm";
import { DatabaseNotConfiguredError, isDatabaseConfigured, withTenant, type Executor } from "@/db/client";
import { appointmentServices, appointments, customers, services, staff, staffServices } from "@/db/schema";
import { fixtureBranchActivity, fixtureBranches } from "@/db/seed/fixtures";
import {
  FALLBACK_DURATION_MINUTES,
  SLOT_HOLDING_STATUSES,
  type Appointment,
  type AppointmentFilters,
  type AppointmentServiceLine,
  type AppointmentStatus,
  type AppointmentType,
} from "./schema";

/** Writes always need a real database; call first so demo mode fails before any other validation. */
export function assertWritable(): void {
  if (!isDatabaseConfigured()) throw new DatabaseNotConfiguredError();
}

export function dataSource(): "database" | "demo" {
  return isDatabaseConfigured() ? "database" : "demo";
}

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

// Total booked time: the snapshotted lines, falling back to the live service for rows that predate them.
const durationExpr = sql<number>`coalesce((select sum(${appointmentServices.durationMinutes}) from ${appointmentServices} where ${appointmentServices.appointmentId} = ${appointments.id}), ${services.durationMinutes}, ${FALLBACK_DURATION_MINUTES})`;

const columns = {
  id: appointments.id,
  branchId: appointments.branchId,
  customerId: appointments.customerId,
  serviceId: appointments.serviceId,
  staffId: appointments.staffId,
  customerName: customers.name,
  staffName: staff.name,
  startsAt: appointments.startsAt,
  durationMinutes: durationExpr.mapWith(Number),
  type: appointments.type,
  status: appointments.status,
  notes: appointments.notes,
};

type Row = Omit<Appointment, "endsAt" | "services" | "totalCents" | "serviceName">;

/** Attach the snapshotted service lines (one extra query for the whole page of rows). */
async function withLines(tx: Executor, tenantId: string, rows: Row[]): Promise<Appointment[]> {
  const lines = rows.length
    ? await tx
        .select({
          appointmentId: appointmentServices.appointmentId,
          id: appointmentServices.id,
          serviceId: appointmentServices.serviceId,
          name: appointmentServices.name,
          priceCents: appointmentServices.priceCents,
          durationMinutes: appointmentServices.durationMinutes,
        })
        .from(appointmentServices)
        .where(and(eq(appointmentServices.tenantId, tenantId), inArray(appointmentServices.appointmentId, rows.map((r) => r.id))))
        .orderBy(asc(appointmentServices.position), asc(appointmentServices.createdAt))
    : [];
  const byAppointment = new Map<string, AppointmentServiceLine[]>();
  for (const { appointmentId, ...line } of lines) byAppointment.set(appointmentId, [...(byAppointment.get(appointmentId) ?? []), line]);
  return rows.map((row) => {
    const services = byAppointment.get(row.id) ?? [];
    return {
      ...row,
      services,
      serviceName: services.length ? services.map((l) => l.name).join(", ") : null,
      totalCents: services.reduce((sum, l) => sum + l.priceCents, 0),
      endsAt: new Date(row.startsAt.getTime() + row.durationMinutes * 60_000),
    };
  });
}

const base = (tx: Executor) =>
  tx
    .select(columns)
    .from(appointments)
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .leftJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(staff, eq(staff.id, appointments.staffId));

/** Appointments starting in [start, end), soonest first. Tenant filter + RLS both apply. */
export async function listBetween(
  tenantId: string,
  start: Date,
  end: Date,
  filters: Pick<AppointmentFilters, "branchId"> = {},
): Promise<Appointment[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, async (tx) =>
    withLines(
      tx,
      tenantId,
      await base(tx)
        .where(
          and(
            eq(appointments.tenantId, tenantId),
            gte(appointments.startsAt, start),
            lt(appointments.startsAt, end),
            filters.branchId ? eq(appointments.branchId, filters.branchId) : undefined,
          ),
        )
        .orderBy(asc(appointments.startsAt), asc(appointments.createdAt)),
    ),
  );
}

/** A customer's appointments, newest first. */
export async function listForCustomer(tenantId: string, customerId: string, limit: number): Promise<Appointment[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, async (tx) =>
    withLines(
      tx,
      tenantId,
      await base(tx)
        .where(and(eq(appointments.tenantId, tenantId), eq(appointments.customerId, customerId)))
        .orderBy(desc(appointments.startsAt), desc(appointments.createdAt))
        .limit(limit),
    ),
  );
}

/** Appointments whose service is finished (status completed), newest first. */
export async function listCompleted(tenantId: string, limit: number): Promise<Appointment[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, async (tx) =>
    withLines(
      tx,
      tenantId,
      await base(tx)
        .where(and(eq(appointments.tenantId, tenantId), eq(appointments.status, "completed")))
        .orderBy(desc(appointments.startsAt), desc(appointments.createdAt))
        .limit(limit),
    ),
  );
}

export async function findById(tenantId: string, id: string): Promise<Appointment | null> {
  if (!isDatabaseConfigured()) return null;
  return withTenant(tenantId, async (tx) => {
    const rows = await base(tx).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id))).limit(1);
    return (await withLines(tx, tenantId, rows))[0] ?? null;
  });
}

/** A service line to snapshot onto the appointment. */
export type BookingLine = { serviceId: string; name: string; priceCents: number; durationMinutes: number };

export type BookingWrite = {
  branchId: string;
  customerId: string | null;
  /** In display order; the first becomes `appointments.service_id`. */
  lines: BookingLine[];
  staffId: string | null;
  startsAt: Date;
  type: AppointmentType;
  notes: string | null;
};

export type BookingResult =
  | { ok: true; id: string }
  | { ok: false; reason: "customer_not_found" }
  | { ok: false; reason: "staff_not_qualified" }
  | { ok: false; reason: "staff_conflict"; startsAt: Date; endsAt: Date };

/**
 * Insert a booking atomically. For an assigned staff member the whole check-then-insert runs under a per-staff
 * advisory lock, so two concurrent requests for overlapping slots cannot both pass the check.
 * Unassigned bookings (no staff) have nobody to collide with and skip the overlap check.
 */
export async function insertBooking(tenantId: string, input: BookingWrite): Promise<BookingResult> {
  const durationMinutes = input.lines.reduce((sum, line) => sum + line.durationMinutes, 0);
  const endsAt = new Date(input.startsAt.getTime() + durationMinutes * 60_000);
  return withTenant(tenantId, async (tx): Promise<BookingResult> => {
    if (input.customerId) {
      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, input.customerId)))
        .limit(1);
      if (!customer) return { ok: false, reason: "customer_not_found" };
    }

    if (input.staffId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`appointments:${input.staffId}`}, 0))`);

      // A staff member who has declared qualifications may only take those services. No declared rows = unrestricted.
      const qualifications = await tx
        .select({ serviceId: staffServices.serviceId })
        .from(staffServices)
        .where(and(eq(staffServices.tenantId, tenantId), eq(staffServices.staffId, input.staffId)));
      const qualified = new Set(qualifications.map((q) => q.serviceId));
      if (qualifications.length && !input.lines.every((line) => qualified.has(line.serviceId))) {
        return { ok: false, reason: "staff_not_qualified" };
      }

      const startIso = input.startsAt.toISOString();
      const endIso = endsAt.toISOString();
      const overlap: SQL = sql`${appointments.startsAt} < ${endIso}::timestamptz and ${appointments.startsAt} + (${durationExpr} * interval '1 minute') > ${startIso}::timestamptz`;
      const [clash] = await tx
        .select({ startsAt: appointments.startsAt, durationMinutes: durationExpr.mapWith(Number) })
        .from(appointments)
        .leftJoin(services, eq(services.id, appointments.serviceId))
        .where(
          and(
            eq(appointments.tenantId, tenantId),
            eq(appointments.staffId, input.staffId),
            inArray(appointments.status, [...SLOT_HOLDING_STATUSES]),
            overlap,
          ),
        )
        .orderBy(asc(appointments.startsAt))
        .limit(1);
      if (clash) {
        return { ok: false, reason: "staff_conflict", startsAt: clash.startsAt, endsAt: new Date(clash.startsAt.getTime() + clash.durationMinutes * 60_000) };
      }
    }

    const [row] = await tx
      .insert(appointments)
      .values({
        tenantId,
        branchId: input.branchId,
        customerId: input.customerId,
        serviceId: input.lines[0]!.serviceId,
        staffId: input.staffId,
        startsAt: input.startsAt,
        type: input.type,
        notes: input.notes,
      })
      .returning({ id: appointments.id });
    await tx.insert(appointmentServices).values(
      input.lines.map((line, position) => ({
        tenantId,
        appointmentId: row!.id,
        serviceId: line.serviceId,
        name: line.name,
        priceCents: line.priceCents,
        durationMinutes: line.durationMinutes,
        position,
      })),
    );
    return { ok: true, id: row!.id };
  });
}

/** Compare-and-set: only moves the row if it is still in `from`, so a stale screen cannot overwrite a newer status. */
export async function transitionStatus(tenantId: string, id: string, from: AppointmentStatus, to: AppointmentStatus): Promise<boolean> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .update(appointments)
      .set({ status: to })
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id), eq(appointments.status, from)))
      .returning({ id: appointments.id }),
  );
  return rows.length > 0;
}
