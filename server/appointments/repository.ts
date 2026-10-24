import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, max, ne, sql, type SQL } from "drizzle-orm";
import { DatabaseNotConfiguredError, isDatabaseConfigured, withTenant, type Executor } from "@/db/client";
import { appointmentServiceEvents, appointmentServices, appointments, customers, reviewRatings, reviewRequests, reviews, services, staff, staffServices } from "@/db/schema";
import { fixtureBranchActivity, fixtureBranches } from "@/db/seed/fixtures";
import {
  canEditAppointment,
  canManageLines,
  canReassignLines,
  canTransitionLine,
  FALLBACK_DURATION_MINUTES,
  MAX_SERVICES_PER_APPOINTMENT,
  SLOT_HOLDING_STATUSES,
  type Appointment,
  type AppointmentFilters,
  type AppointmentServiceLine,
  type AppointmentStatus,
  type AppointmentType,
  type PublicReview,
  type ServiceLineEvent,
  type ServiceLineStatus,
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

const lineColumns = {
  appointmentId: appointmentServices.appointmentId,
  id: appointmentServices.id,
  serviceId: appointmentServices.serviceId,
  name: appointmentServices.name,
  priceCents: appointmentServices.priceCents,
  durationMinutes: appointmentServices.durationMinutes,
  status: appointmentServices.status,
  staffId: appointmentServices.staffId,
  staffName: staff.name,
  startedAt: appointmentServices.startedAt,
  completedAt: appointmentServices.completedAt,
  performedByName: appointmentServices.performedByName,
};

/** A line for a list: only the fields a card shows. Keys are left out (not nulled) because each one is serialised per line. */
function leanLine(line: AppointmentServiceLine, team: { staffId?: string | null; staffName?: string | null }): AppointmentServiceLine {
  const { id, serviceId, name, priceCents, durationMinutes, status } = line;
  return { id, serviceId, name, priceCents, durationMinutes, status, ...team };
}

/**
 * Attach the snapshotted service lines (one extra query for the whole page of rows).
 * Lists (the board, history) get lean lines: a team member is named only where it differs from the appointment's own,
 * and the completion detail is left out, because every byte here is serialised to the browser for every card. The
 * services screen and billing read one appointment with `detail`, which resolves everything.
 */
async function withLines(tx: Executor, tenantId: string, rows: Row[], detail = false): Promise<Appointment[]> {
  const lines = rows.length
    ? await tx
        .select(lineColumns)
        .from(appointmentServices)
        .leftJoin(staff, eq(staff.id, appointmentServices.staffId))
        .where(and(eq(appointmentServices.tenantId, tenantId), inArray(appointmentServices.appointmentId, rows.map((r) => r.id))))
        .orderBy(asc(appointmentServices.position), asc(appointmentServices.createdAt))
    : [];
  const byAppointment = new Map<string, AppointmentServiceLine[]>();
  const lead = new Map(rows.map((r) => [r.id, r] as const));
  for (const { appointmentId, ...line } of lines) {
    // Rows written before per-service staff existed fall back to the appointment's team member.
    const owner = lead.get(appointmentId);
    const staffId = line.staffId ?? owner?.staffId ?? null;
    const staffName = line.staffName ?? (line.staffId ? null : (owner?.staffName ?? null));
    const resolved = detail ? { ...line, staffId, staffName } : leanLine(line, staffId === owner?.staffId ? {} : { staffId, staffName });
    byAppointment.set(appointmentId, [...(byAppointment.get(appointmentId) ?? []), resolved]);
  }
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
    return (await withLines(tx, tenantId, rows, true))[0] ?? null;
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

export type BookingFailure =
  | { ok: false; reason: "customer_not_found" }
  | { ok: false; reason: "staff_not_qualified" }
  | { ok: false; reason: "staff_conflict"; startsAt: Date; endsAt: Date };

export type BookingResult = { ok: true; id: string } | BookingFailure;

export type UpdateBookingResult = { ok: true } | BookingFailure | { ok: false; reason: "not_found" } | { ok: false; reason: "not_editable" };

/**
 * The checks every booking write shares, run inside the writing transaction: the customer exists in this tenant,
 * the staff member performs every service, and (for an assigned staff member) the slot is free. `ignoreId` is the
 * appointment being rescheduled, so it never collides with itself. Callers hold the per-staff advisory lock.
 */
async function checkBooking(tx: Executor, tenantId: string, input: BookingWrite, endsAt: Date, ignoreId?: string): Promise<BookingFailure | null> {
  if (input.customerId) {
    const [customer] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, input.customerId)))
      .limit(1);
    if (!customer) return { ok: false, reason: "customer_not_found" };
  }
  if (!input.staffId) return null;

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
        ignoreId ? ne(appointments.id, ignoreId) : undefined,
        inArray(appointments.status, [...SLOT_HOLDING_STATUSES]),
        overlap,
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(1);
  if (clash) return { ok: false, reason: "staff_conflict", startsAt: clash.startsAt, endsAt: new Date(clash.startsAt.getTime() + clash.durationMinutes * 60_000) };
  return null;
}

const lockStaff = (tx: Executor, staffId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`appointments:${staffId}`}, 0))`);

const totalMinutes = (lines: BookingLine[]) => lines.reduce((sum, line) => sum + line.durationMinutes, 0);

const lineRows = (tenantId: string, appointmentId: string, lines: BookingLine[], staffId: string | null) =>
  lines.map((line, position) => ({
    tenantId,
    appointmentId,
    serviceId: line.serviceId,
    name: line.name,
    priceCents: line.priceCents,
    durationMinutes: line.durationMinutes,
    position,
    staffId,
  }));

/**
 * Insert a booking atomically. For an assigned staff member the whole check-then-insert runs under a per-staff
 * advisory lock, so two concurrent requests for overlapping slots cannot both pass the check.
 * Unassigned bookings (no staff) have nobody to collide with and skip the overlap check.
 */
export async function insertBooking(tenantId: string, input: BookingWrite): Promise<BookingResult> {
  const endsAt = new Date(input.startsAt.getTime() + totalMinutes(input.lines) * 60_000);
  return withTenant(tenantId, async (tx): Promise<BookingResult> => {
    if (input.staffId) await lockStaff(tx, input.staffId);
    const failure = await checkBooking(tx, tenantId, input, endsAt);
    if (failure) return failure;

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
    await tx.insert(appointmentServices).values(lineRows(tenantId, row!.id, input.lines, input.staffId));
    return { ok: true, id: row!.id };
  });
}

/**
 * Reschedule / edit a booking that hasn't been checked in. Same atomic checks as `insertBooking`, with the
 * appointment locked first so a concurrent status change cannot slip in between the check and the write. The
 * snapshot service lines are replaced with the newly chosen ones.
 */
export async function updateBooking(tenantId: string, id: string, input: BookingWrite): Promise<UpdateBookingResult> {
  const endsAt = new Date(input.startsAt.getTime() + totalMinutes(input.lines) * 60_000);
  return withTenant(tenantId, async (tx): Promise<UpdateBookingResult> => {
    if (input.staffId) await lockStaff(tx, input.staffId);
    const [current] = await tx
      .select({ type: appointments.type, status: appointments.status })
      .from(appointments)
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .limit(1)
      .for("update");
    if (!current) return { ok: false, reason: "not_found" };
    if (!canEditAppointment(current)) return { ok: false, reason: "not_editable" };

    const failure = await checkBooking(tx, tenantId, input, endsAt, id);
    if (failure) return failure;

    await tx
      .update(appointments)
      .set({
        branchId: input.branchId,
        customerId: input.customerId,
        serviceId: input.lines[0]!.serviceId,
        staffId: input.staffId,
        startsAt: input.startsAt,
        notes: input.notes,
      })
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)));
    await tx.delete(appointmentServices).where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.appointmentId, id)));
    await tx.insert(appointmentServices).values(lineRows(tenantId, id, input.lines, input.staffId));
    return { ok: true };
  });
}

/**
 * Permanently remove an appointment. Its own snapshot service lines go with it (ON DELETE CASCADE). Invoices and
 * payments are separate financial records: their `appointment_id` is set to null and everything else is kept.
 */
export async function deleteById(tenantId: string, id: string): Promise<boolean> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .delete(appointments)
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
      .returning({ id: appointments.id }),
  );
  return rows.length > 0;
}

/**
 * Compare-and-set: only moves the row if it is still in `from`, so a stale screen cannot overwrite a newer status.
 * Completing the visit also closes every service that is not done yet, in the same transaction ("Complete" means all
 * the work is finished), so an appointment never reads completed with open services.
 */
export async function transitionStatus(
  tenantId: string,
  id: string,
  from: AppointmentStatus,
  to: AppointmentStatus,
  actorUserId: string | null = null,
  now = new Date(),
): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .update(appointments)
      .set({ status: to })
      .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id), eq(appointments.status, from)))
      .returning({ id: appointments.id });
    if (!rows.length) return false;
    if (to === "completed") await completeOpenLines(tx, tenantId, id, actorUserId, now);
    return true;
  });
}

// --- Service lines (add / remove / start / complete / reassign) -------------------------------------------------

type Person = { id: string; name: string };

async function staffNames(tx: Executor, tenantId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (!wanted.length) return new Map();
  const rows = await tx.select({ id: staff.id, name: staff.name }).from(staff).where(and(eq(staff.tenantId, tenantId), inArray(staff.id, wanted)));
  return new Map(rows.map((r) => [r.id, r.name]));
}

type EventDraft = {
  kind: ServiceLineEvent["kind"];
  serviceName: string;
  fromStatus?: ServiceLineStatus | null;
  toStatus?: ServiceLineStatus | null;
  from?: Person | null;
  to?: Person | null;
  reason?: string | null;
};

const logEvent = (tx: Executor, tenantId: string, appointmentId: string, lineId: string, actorUserId: string | null, e: EventDraft) =>
  tx.insert(appointmentServiceEvents).values({
    tenantId,
    appointmentId,
    serviceLineId: lineId,
    serviceName: e.serviceName,
    kind: e.kind,
    fromStatus: e.fromStatus ?? null,
    toStatus: e.toStatus ?? null,
    fromStaffId: e.from?.id ?? null,
    fromStaffName: e.from?.name ?? null,
    toStaffId: e.to?.id ?? null,
    toStaffName: e.to?.name ?? null,
    reason: e.reason ?? null,
    actorUserId,
  });

/** Close every open line of a visit that is being completed. Whoever is on the line is recorded as having done it. */
async function completeOpenLines(tx: Executor, tenantId: string, appointmentId: string, actorUserId: string | null, now: Date): Promise<void> {
  const open = await tx
    .select({ id: appointmentServices.id, name: appointmentServices.name, status: appointmentServices.status, staffId: appointmentServices.staffId })
    .from(appointmentServices)
    .where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.appointmentId, appointmentId), ne(appointmentServices.status, "completed")));
  if (!open.length) return;
  const [visit] = await tx.select({ staffId: appointments.staffId }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointmentId))).limit(1);
  const names = await staffNames(tx, tenantId, [visit?.staffId ?? null, ...open.map((l) => l.staffId)]);
  for (const line of open) {
    const staffId = line.staffId ?? visit?.staffId ?? null;
    const who = staffId ? { id: staffId, name: names.get(staffId) ?? "Former team member" } : null;
    await tx
      .update(appointmentServices)
      .set({
        status: "completed",
        staffId,
        startedAt: sql`coalesce(${appointmentServices.startedAt}, ${now.toISOString()}::timestamptz)`,
        completedAt: now,
        performedByStaffId: who?.id ?? null,
        performedByName: who?.name ?? null,
      })
      .where(eq(appointmentServices.id, line.id));
    await logEvent(tx, tenantId, appointmentId, line.id, actorUserId, { kind: "completed", serviceName: line.name, fromStatus: line.status, toStatus: "completed", to: who });
  }
}

export type LineFailure =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "line_not_found" }
  | { ok: false; reason: "appointment_state"; status: AppointmentStatus }
  | { ok: false; reason: "line_state"; status: ServiceLineStatus }
  | { ok: false; reason: "limit" }
  | { ok: false; reason: "duplicate" }
  | { ok: false; reason: "last_line" }
  | { ok: false; reason: "staff_required" }
  | { ok: false; reason: "staff_invalid" }
  | { ok: false; reason: "staff_not_qualified"; staffName: string }
  | { ok: false; reason: "reason_required" }
  | { ok: false; reason: "unchanged" };
export type LineResult<T = object> = ({ ok: true } & T) | LineFailure;

/** The appointment row, locked for the rest of the transaction so concurrent line changes and status moves serialise. */
async function lockAppointment(tx: Executor, tenantId: string, id: string) {
  const [row] = await tx
    .select({ id: appointments.id, branchId: appointments.branchId, staffId: appointments.staffId, status: appointments.status })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, id)))
    .limit(1)
    .for("update");
  return row ?? null;
}

/**
 * The team member must be an active member of this tenant working at the appointment's branch, and (if they declared
 * qualifications) perform the service. Checked inside the writing transaction so it cannot go stale.
 */
async function checkStaff(
  tx: Executor,
  tenantId: string,
  branchId: string,
  staffId: string,
  serviceId: string | null,
): Promise<Person | Extract<LineFailure, { reason: "staff_invalid" | "staff_not_qualified" }>> {
  const [member] = await tx.select({ id: staff.id, name: staff.name, active: staff.active, branchId: staff.branchId }).from(staff).where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId))).limit(1);
  if (!member || !member.active || member.branchId !== branchId) return { ok: false, reason: "staff_invalid" };
  if (serviceId) {
    const declared = await tx.select({ serviceId: staffServices.serviceId }).from(staffServices).where(and(eq(staffServices.tenantId, tenantId), eq(staffServices.staffId, staffId)));
    if (declared.length && !declared.some((d) => d.serviceId === serviceId)) return { ok: false, reason: "staff_not_qualified", staffName: member.name };
  }
  return { id: member.id, name: member.name };
}
const isFailure = (v: Person | LineFailure): v is LineFailure => "ok" in v;

/** Keep the appointment's own team member in step with its lines when they all agree (the board column, checkout defaults). */
async function syncLead(tx: Executor, tenantId: string, appointmentId: string): Promise<void> {
  const lines = await tx.select({ staffId: appointmentServices.staffId }).from(appointmentServices).where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.appointmentId, appointmentId)));
  const first = lines[0]?.staffId;
  if (first && lines.every((l) => l.staffId === first)) {
    await tx.update(appointments).set({ staffId: first }).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointmentId)));
  }
}

export async function addLine(
  tenantId: string,
  actorUserId: string | null,
  input: { appointmentId: string; line: BookingLine; staffId: string | null },
): Promise<LineResult<{ lineId: string }>> {
  return withTenant(tenantId, async (tx): Promise<LineResult<{ lineId: string }>> => {
    const visit = await lockAppointment(tx, tenantId, input.appointmentId);
    if (!visit) return { ok: false, reason: "not_found" };
    if (!canManageLines(visit.status)) return { ok: false, reason: "appointment_state", status: visit.status };

    const existing = await tx.select({ serviceId: appointmentServices.serviceId }).from(appointmentServices).where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.appointmentId, visit.id)));
    if (existing.length >= MAX_SERVICES_PER_APPOINTMENT) return { ok: false, reason: "limit" };
    if (existing.some((l) => l.serviceId === input.line.serviceId)) return { ok: false, reason: "duplicate" };

    const staffId = input.staffId ?? visit.staffId;
    let who: Person | null = null;
    if (staffId) {
      const checked = await checkStaff(tx, tenantId, visit.branchId, staffId, input.line.serviceId);
      if (isFailure(checked)) return checked;
      who = checked;
    }
    const [last] = await tx
      .select({ position: max(appointmentServices.position) })
      .from(appointmentServices)
      .where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.appointmentId, visit.id)));
    const [row] = await tx
      .insert(appointmentServices)
      .values({
        tenantId,
        appointmentId: visit.id,
        serviceId: input.line.serviceId,
        name: input.line.name,
        priceCents: input.line.priceCents,
        durationMinutes: input.line.durationMinutes,
        position: (last?.position ?? -1) + 1,
        staffId: who?.id ?? null,
      })
      .returning({ id: appointmentServices.id });
    await logEvent(tx, tenantId, visit.id, row!.id, actorUserId, { kind: "added", serviceName: input.line.name, toStatus: "pending", to: who });
    return { ok: true, lineId: row!.id };
  });
}

export async function removeLine(tenantId: string, actorUserId: string | null, input: { appointmentId: string; lineId: string }): Promise<LineResult> {
  return withTenant(tenantId, async (tx): Promise<LineResult> => {
    const visit = await lockAppointment(tx, tenantId, input.appointmentId);
    if (!visit) return { ok: false, reason: "not_found" };
    if (!canManageLines(visit.status)) return { ok: false, reason: "appointment_state", status: visit.status };

    const lines = await tx
      .select()
      .from(appointmentServices)
      .where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.appointmentId, visit.id)))
      .orderBy(asc(appointmentServices.position), asc(appointmentServices.createdAt));
    const line = lines.find((l) => l.id === input.lineId);
    if (!line) return { ok: false, reason: "line_not_found" };
    // Only a service nobody has started can go; started or finished work stays on the record (and the bill).
    if (line.status !== "pending") return { ok: false, reason: "line_state", status: line.status };
    if (lines.length === 1) return { ok: false, reason: "last_line" };

    await tx.delete(appointmentServices).where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.id, line.id)));
    const remaining = lines.filter((l) => l.id !== line.id);
    await tx.update(appointments).set({ serviceId: remaining[0]!.serviceId }).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, visit.id)));
    const names = await staffNames(tx, tenantId, [line.staffId]);
    await logEvent(tx, tenantId, visit.id, line.id, actorUserId, {
      kind: "removed",
      serviceName: line.name,
      fromStatus: line.status,
      from: line.staffId ? { id: line.staffId, name: names.get(line.staffId) ?? "Former team member" } : null,
    });
    await syncLead(tx, tenantId, visit.id);
    return { ok: true };
  });
}

export async function changeLineStatus(
  tenantId: string,
  actorUserId: string | null,
  input: { appointmentId: string; lineId: string; to: ServiceLineStatus },
  now: Date,
): Promise<LineResult> {
  return withTenant(tenantId, async (tx): Promise<LineResult> => {
    const visit = await lockAppointment(tx, tenantId, input.appointmentId);
    if (!visit) return { ok: false, reason: "not_found" };
    if (!canManageLines(visit.status)) return { ok: false, reason: "appointment_state", status: visit.status };

    const [line] = await tx
      .select()
      .from(appointmentServices)
      .where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.appointmentId, visit.id), eq(appointmentServices.id, input.lineId)))
      .limit(1);
    if (!line) return { ok: false, reason: "line_not_found" };
    if (!canTransitionLine(line.status, input.to)) return { ok: false, reason: "line_state", status: line.status };

    const staffId = line.staffId ?? visit.staffId;
    if (!staffId) return { ok: false, reason: "staff_required" };
    const who = (await staffNames(tx, tenantId, [staffId])).get(staffId) ?? "Former team member";

    // Compare-and-set on the line too, so a double click or a second screen cannot apply the same move twice.
    const changed = await tx
      .update(appointmentServices)
      .set(
        input.to === "in_progress"
          ? { status: "in_progress", staffId, startedAt: now }
          : { status: "completed", staffId, completedAt: now, performedByStaffId: staffId, performedByName: who },
      )
      .where(and(eq(appointmentServices.id, line.id), eq(appointmentServices.status, line.status)))
      .returning({ id: appointmentServices.id });
    if (!changed.length) return { ok: false, reason: "line_state", status: line.status };

    // The first service to start puts the visit in service. Nothing a line does ever completes the visit.
    if (input.to === "in_progress" && visit.status === "checked_in") {
      await tx
        .update(appointments)
        .set({ status: "in_service" })
        .where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, visit.id), eq(appointments.status, "checked_in")));
    }
    await logEvent(tx, tenantId, visit.id, line.id, actorUserId, {
      kind: input.to === "in_progress" ? "started" : "completed",
      serviceName: line.name,
      fromStatus: line.status,
      toStatus: input.to,
      to: { id: staffId, name: who },
    });
    return { ok: true };
  });
}

/**
 * Move one service to another team member. Before completion this is a plain reassignment. After completion it is a
 * correction: the line's current team member changes, but `performed_by_*` (who was recorded as doing it) and the
 * completion time are left alone, and the event records who it moved from and to, why, and who made the change.
 */
export async function reassignLine(
  tenantId: string,
  actorUserId: string | null,
  input: { appointmentId: string; lineId: string; staffId: string; reason: string | null },
): Promise<LineResult> {
  return withTenant(tenantId, async (tx): Promise<LineResult> => {
    const visit = await lockAppointment(tx, tenantId, input.appointmentId);
    if (!visit) return { ok: false, reason: "not_found" };
    if (!canReassignLines(visit.status)) return { ok: false, reason: "appointment_state", status: visit.status };

    const [line] = await tx
      .select()
      .from(appointmentServices)
      .where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.appointmentId, visit.id), eq(appointmentServices.id, input.lineId)))
      .limit(1);
    if (!line) return { ok: false, reason: "line_not_found" };
    // Changing who is credited with finished work needs an explanation on the record.
    if (line.status === "completed" && !input.reason) return { ok: false, reason: "reason_required" };
    const currentId = line.staffId ?? visit.staffId;
    if (currentId === input.staffId) return { ok: false, reason: "unchanged" };

    const to = await checkStaff(tx, tenantId, visit.branchId, input.staffId, line.serviceId);
    if (isFailure(to)) return to;
    const names = await staffNames(tx, tenantId, [currentId]);

    await tx.update(appointmentServices).set({ staffId: to.id }).where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.id, line.id)));
    await syncLead(tx, tenantId, visit.id);
    await logEvent(tx, tenantId, visit.id, line.id, actorUserId, {
      kind: line.status === "completed" ? "corrected" : "reassigned",
      serviceName: line.name,
      from: currentId ? { id: currentId, name: names.get(currentId) ?? "Former team member" } : null,
      to,
      reason: input.reason,
    });
    return { ok: true };
  });
}

/** The service history of one appointment, oldest first. */
export async function listLineEvents(tenantId: string, appointmentId: string): Promise<ServiceLineEvent[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: appointmentServiceEvents.id,
        kind: appointmentServiceEvents.kind,
        serviceName: appointmentServiceEvents.serviceName,
        fromStaffName: appointmentServiceEvents.fromStaffName,
        toStaffName: appointmentServiceEvents.toStaffName,
        reason: appointmentServiceEvents.reason,
        createdAt: appointmentServiceEvents.createdAt,
      })
      .from(appointmentServiceEvents)
      .where(and(eq(appointmentServiceEvents.tenantId, tenantId), eq(appointmentServiceEvents.appointmentId, appointmentId)))
      .orderBy(asc(appointmentServiceEvents.createdAt), asc(appointmentServiceEvents.id)),
  );
  return rows as ServiceLineEvent[];
}

// --- Customer reviews -----------------------------------------------------------------------------------------

export type ReviewRequestRow = { id: string; appointmentId: string; nonce: string; expiresAt: Date; submittedAt: Date | null };

/**
 * The review request for a completed appointment, created on first use. One row per appointment (unique index), so
 * concurrent receipt views converge on the same nonce. Null when the appointment is missing or not completed.
 */
export async function ensureReviewRequest(tenantId: string, appointmentId: string, nonce: string, expiresAt: Date): Promise<ReviewRequestRow | null> {
  assertWritable();
  return withTenant(tenantId, async (tx) => {
    const [visit] = await tx.select({ status: appointments.status }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointmentId))).limit(1);
    if (!visit || visit.status !== "completed") return null;
    await tx.insert(reviewRequests).values({ tenantId, appointmentId, nonce, expiresAt }).onConflictDoNothing({ target: [reviewRequests.tenantId, reviewRequests.appointmentId] });
    const [row] = await tx
      .select({ id: reviewRequests.id, appointmentId: reviewRequests.appointmentId, nonce: reviewRequests.nonce, expiresAt: reviewRequests.expiresAt, submittedAt: reviewRequests.submittedAt })
      .from(reviewRequests)
      .where(and(eq(reviewRequests.tenantId, tenantId), eq(reviewRequests.appointmentId, appointmentId)))
      .limit(1);
    return row ?? null;
  });
}

type ReviewTargets = {
  services: { id: string; name: string; staffId: string | null }[];
  staff: { id: string; name: string; serviceNames: string[] }[];
};

/** What can be rated for one visit: its services, and each distinct team member credited with them. */
async function loadReviewTargets(tx: Executor, tenantId: string, appointmentId: string): Promise<ReviewTargets | null> {
  const [visit] = await tx.select({ status: appointments.status, staffId: appointments.staffId }).from(appointments).where(and(eq(appointments.tenantId, tenantId), eq(appointments.id, appointmentId))).limit(1);
  if (!visit || visit.status !== "completed") return null;
  const lines = await tx
    .select({ id: appointmentServices.id, name: appointmentServices.name, staffId: appointmentServices.staffId, staffName: staff.name })
    .from(appointmentServices)
    .leftJoin(staff, eq(staff.id, appointmentServices.staffId))
    .where(and(eq(appointmentServices.tenantId, tenantId), eq(appointmentServices.appointmentId, appointmentId)))
    .orderBy(asc(appointmentServices.position), asc(appointmentServices.createdAt));
  if (!lines.length) return null;
  const fallbackName = visit.staffId ? ((await staffNames(tx, tenantId, [visit.staffId])).get(visit.staffId) ?? null) : null;
  const resolved = lines.map((l) => (l.staffId ? { ...l } : { ...l, staffId: visit.staffId, staffName: fallbackName }));
  const people = new Map<string, { id: string; name: string; serviceNames: string[] }>();
  for (const l of resolved) {
    if (!l.staffId || !l.staffName) continue;
    const person = people.get(l.staffId) ?? { id: l.staffId, name: l.staffName, serviceNames: [] };
    person.serviceNames.push(l.name);
    people.set(l.staffId, person);
  }
  return { services: resolved.map((l) => ({ id: l.id, name: l.name, staffId: l.staffId })), staff: [...people.values()] };
}

async function findRequest(tx: Executor, tenantId: string, nonce: string, lock: boolean) {
  const query = tx
    .select({ id: reviewRequests.id, appointmentId: reviewRequests.appointmentId, expiresAt: reviewRequests.expiresAt, submittedAt: reviewRequests.submittedAt })
    .from(reviewRequests)
    .where(and(eq(reviewRequests.tenantId, tenantId), eq(reviewRequests.nonce, nonce)))
    .limit(1);
  const [row] = await (lock ? query.for("update") : query);
  return row ?? null;
}

/** The public page's view of one request. A missing request and a wrong tenant look the same: `invalid`. */
export async function readPublicReview(tenantId: string, nonce: string, now: Date): Promise<PublicReview> {
  if (!isDatabaseConfigured()) return { state: "invalid" };
  return withTenant(tenantId, async (tx): Promise<PublicReview> => {
    const request = await findRequest(tx, tenantId, nonce, false);
    if (!request) return { state: "invalid" };
    if (request.submittedAt) return { state: "submitted" };
    if (request.expiresAt.getTime() <= now.getTime()) return { state: "expired" };
    const targets = await loadReviewTargets(tx, tenantId, request.appointmentId);
    return targets ? { state: "open", expiresAt: request.expiresAt, ...targets } : { state: "invalid" };
  });
}

export type ReviewWrite = { salonRating: number; comment: string | null; serviceRatings: Record<string, number>; staffRatings: Record<string, number> };
export type SubmitReviewResult = { ok: true } | { ok: false; reason: "invalid" | "expired" | "submitted" | "unknown_target" };

/**
 * Store the one review a request accepts. The request row is locked, so two submissions of the same link (a double
 * tap, a replay) serialise: the first wins and every later one reads `submitted`. Rating keys are checked against
 * the visit's own services and team here, inside the transaction, and names are snapshotted onto the ratings.
 */
export async function submitReview(tenantId: string, nonce: string, input: ReviewWrite, now: Date): Promise<SubmitReviewResult> {
  assertWritable();
  return withTenant(tenantId, async (tx): Promise<SubmitReviewResult> => {
    const request = await findRequest(tx, tenantId, nonce, true);
    if (!request) return { ok: false, reason: "invalid" };
    if (request.submittedAt) return { ok: false, reason: "submitted" };
    if (request.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
    const targets = await loadReviewTargets(tx, tenantId, request.appointmentId);
    if (!targets) return { ok: false, reason: "invalid" };

    const lineById = new Map(targets.services.map((s) => [s.id, s]));
    const personById = new Map(targets.staff.map((s) => [s.id, s]));
    if (Object.keys(input.serviceRatings).some((k) => !lineById.has(k)) || Object.keys(input.staffRatings).some((k) => !personById.has(k))) {
      return { ok: false, reason: "unknown_target" };
    }

    const [review] = await tx
      .insert(reviews)
      .values({ tenantId, requestId: request.id, appointmentId: request.appointmentId, salonRating: input.salonRating, comment: input.comment, createdAt: now })
      .returning({ id: reviews.id });
    const rows = [
      ...Object.entries(input.serviceRatings).map(([lineId, rating]) => ({ tenantId, reviewId: review!.id, kind: "service", serviceLineId: lineId, staffId: null, label: lineById.get(lineId)!.name, rating })),
      ...Object.entries(input.staffRatings).map(([staffId, rating]) => ({ tenantId, reviewId: review!.id, kind: "staff", serviceLineId: null, staffId, label: personById.get(staffId)!.name, rating })),
    ];
    if (rows.length) await tx.insert(reviewRatings).values(rows);
    await tx.update(reviewRequests).set({ submittedAt: now }).where(and(eq(reviewRequests.tenantId, tenantId), eq(reviewRequests.id, request.id)));
    return { ok: true };
  });
}
