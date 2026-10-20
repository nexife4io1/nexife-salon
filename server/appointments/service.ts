import "server-only";
import { zonedDateString, zonedDayRange, zonedTimeString, zonedTimeToUtc } from "@/lib/dates";
import type { TenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
// Cross-domain reads go through other domains' services — never their repositories.
import * as branchesService from "@/server/branches/service";
import * as customersService from "@/server/customers/service";
import * as staffService from "@/server/staff/service";
import * as tenantsService from "@/server/tenants/service";
import * as repo from "./repository";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  UPCOMING_STATUSES,
  canEditAppointment,
  canMarkNoShow,
  canTransition,
  type AppointmentBoard,
  type AppointmentFilters,
  type AppointmentStatus,
  type BookAppointmentInput,
  type BookingOptions,
  type ChangeAppointmentStatusInput,
  type EditableAppointment,
} from "./schema";

/** A booking may start up to this long before "now" (clock skew / a form left open for a moment). */
const PAST_GRACE_MS = 5 * 60_000;

async function tenantTimezone(tenantId: string): Promise<string> {
  return (await tenantsService.getTenant(tenantId)).timezone;
}

/** Per-branch count of today's appointments, where "today" is the tenant's calendar day. */
export async function countTodayByBranch(tenantId: string, now = new Date()) {
  const timezone = await tenantTimezone(tenantId);
  const { start, end } = zonedDayRange(zonedDateString(now, timezone), timezone);
  return repo.countByBranchBetween(tenantId, start, end);
}

export async function listToday(tenantId: string, now = new Date()) {
  const timezone = await tenantTimezone(tenantId);
  const { start, end } = zonedDayRange(zonedDateString(now, timezone), timezone);
  return repo.listBetween(tenantId, start, end);
}

// --- Board (list / calendar) ---------------------------------------------------------------------

export async function getBoard(ctx: TenantContext, filters: AppointmentFilters, now = new Date()): Promise<AppointmentBoard> {
  const timezone = await tenantTimezone(ctx.tenantId);
  const today = zonedDateString(now, timezone);
  const date = filters.date ?? today;
  const { start, end } = zonedDayRange(date, timezone);

  const [overview, staff, dayRows] = await Promise.all([
    branchesService.getOverview(ctx.tenantId),
    staffService.listStaff(ctx.tenantId),
    repo.listBetween(ctx.tenantId, start, end, { branchId: filters.branchId }),
  ]);

  const counts = Object.fromEntries(APPOINTMENT_STATUSES.map((s) => [s, 0])) as Record<AppointmentStatus, number>;
  for (const row of dayRows) counts[row.status] += 1;

  // No status chosen = what still needs attention (not the day's finished and closed appointments).
  const status = filters.status ?? "upcoming";
  return {
    date,
    today,
    now,
    timezone,
    filters: { ...filters, date },
    appointments:
      status === "all"
        ? dayRows
        : dayRows.filter((row) => (status === "upcoming" ? (UPCOMING_STATUSES as readonly AppointmentStatus[]).includes(row.status) : row.status === status)),
    staff: staff
      .filter((s) => s.active && (!filters.branchId || s.branchId === filters.branchId))
      .map((s) => ({ id: s.id, name: s.name, title: s.title, branchId: s.branchId })),
    branches: overview.branches.map((b) => ({ id: b.id, name: b.name })),
    counts,
    source: repo.dataSource(),
  };
}

// --- Booking -----------------------------------------------------------------------------------------

export async function getBookingOptions(ctx: TenantContext, now = new Date(), includeCustomerId?: string): Promise<BookingOptions> {
  const [tenant, overview, services, staff, assignments, customers] = await Promise.all([
    tenantsService.getTenant(ctx.tenantId),
    branchesService.getOverview(ctx.tenantId),
    tenantsService.listTenantServices(ctx.tenantId),
    staffService.listStaff(ctx.tenantId),
    staffService.listServiceAssignments(ctx.tenantId),
    customersService.searchCustomers(ctx.tenantId, { limit: 100 }),
  ]);
  // A customer arriving via ?customerId may sit beyond the first page of results; make sure they are selectable.
  if (includeCustomerId && !customers.some((c) => c.id === includeCustomerId)) {
    const profile = await customersService.getProfile(ctx.tenantId, includeCustomerId).catch(() => null);
    if (profile) customers.unshift({ id: profile.id, name: profile.name, phone: profile.phone } as (typeof customers)[number]);
  }
  const branches = overview.branches.filter((b) => b.status !== "inactive").map((b) => ({ id: b.id, name: b.name, status: b.status }));
  const offered = await Promise.all(branches.map(async (b) => [b.id, (await branchesService.getBranchServices(ctx, b.id)).offeredIds] as const));
  const activeServiceIds = new Set(services.map((s) => s.id));

  return {
    timezone: tenant.timezone,
    currency: tenant.currency,
    today: zonedDateString(now, tenant.timezone),
    nowTime: zonedTimeString(now, tenant.timezone),
    branches,
    services: services.map((s) => ({ id: s.id, name: s.name, category: s.category, durationMinutes: s.durationMinutes, priceCents: s.priceCents })),
    offeredByBranch: Object.fromEntries(offered.map(([branchId, ids]) => [branchId, ids.filter((id) => activeServiceIds.has(id))])),
    staff: staff.filter((s) => s.active && s.branchId).map((s) => ({ id: s.id, name: s.name, title: s.title, branchId: s.branchId })),
    staffServices: Object.fromEntries(assignments),
    customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    source: repo.dataSource(),
  };
}

function timeRange(a: Date, b: Date, timezone: string): string {
  return `${zonedTimeString(a, timezone)}–${zonedTimeString(b, timezone)}`;
}

type PreparedBooking = { timezone: string; staffName: string | null; write: repo.BookingWrite };

/**
 * Validate everything a booking points at (all of it must belong to this tenant, and fit together) and turn it
 * into the trusted write model. Shared by booking and editing. When rescheduling, `currentStartsAt` is the time
 * the appointment already has: keeping it is allowed even if it has since passed.
 */
async function prepareBooking(ctx: TenantContext, input: BookAppointmentInput, now: Date, currentStartsAt?: Date): Promise<PreparedBooking> {
  const tenant = await tenantsService.getTenant(ctx.tenantId);
  const errors: Record<string, string[]> = {};
  const fail = (field: string, message: string) => (errors[field] ??= []).push(message);

  // Branch: must be one of this tenant's, and open for business.
  let branchOk = false;
  try {
    const branch = await branchesService.getBranch(ctx.tenantId, input.branchId);
    if (branch.status === "inactive") fail("branchId", "That branch is inactive");
    else branchOk = true;
  } catch (error) {
    if (!(error instanceof AppError && error.code === "NOT_FOUND")) throw error;
    fail("branchId", "Choose one of your branches");
  }

  // Services: each must be an active service of this tenant that the chosen branch offers.
  const catalog = await tenantsService.listTenantServices(ctx.tenantId);
  const chosen = input.serviceId.map((id) => catalog.find((s) => s.id === id));
  if (chosen.some((s) => !s)) fail("serviceId", "Choose your active services");
  else if (branchOk) {
    const { offeredIds } = await branchesService.getBranchServices(ctx, input.branchId);
    const missing = chosen.filter((s) => s && !offeredIds.includes(s.id));
    if (missing.length) fail("serviceId", `This branch doesn't offer ${missing.map((s) => s!.name).join(", ")}`);
  }

  // Staff (optional): an active member of the tenant working at the chosen branch.
  let staffName: string | null = null;
  if (input.staffId) {
    const member = (await staffService.listStaff(ctx.tenantId)).find((s) => s.id === input.staffId);
    if (!member || !member.active) fail("staffId", "Choose an active team member");
    else if (member.branchId !== input.branchId) fail("staffId", `${member.name} doesn't work at this branch`);
    else staffName = member.name;
  }

  // When: walk-ins start now; bookings use the tenant-local date + time.
  let startsAt = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  if (input.type === "booking") {
    const at = zonedTimeToUtc(input.date ?? "", input.time ?? "", tenant.timezone);
    if (!at) fail("time", "That time doesn't exist on this date. Choose another");
    else if (at.getTime() < now.getTime() - PAST_GRACE_MS && at.getTime() !== currentStartsAt?.getTime()) fail("time", "Choose a time that hasn't passed");
    else startsAt = at;
  }

  if (Object.keys(errors).length) throw new AppError("VALIDATION", "Please fix the highlighted fields.", errors);

  return {
    timezone: tenant.timezone,
    staffName,
    write: {
      branchId: input.branchId,
      customerId: input.customerId ?? null,
      lines: chosen.map((s) => ({ serviceId: s!.id, name: s!.name, priceCents: s!.priceCents, durationMinutes: s!.durationMinutes })),
      staffId: input.staffId ?? null,
      startsAt,
      type: input.type,
      notes: input.notes ?? null,
    },
  };
}

/** Turn a repository rejection (customer / qualification / clash) into the error the form shows. */
function throwBookingFailure(failure: repo.BookingFailure, prepared: PreparedBooking): never {
  const who = prepared.staffName ?? "That team member";
  switch (failure.reason) {
    case "customer_not_found":
      throw new AppError("VALIDATION", "Please fix the highlighted fields.", { customerId: ["Choose one of your customers"] });
    case "staff_not_qualified":
      throw new AppError("VALIDATION", "Please fix the highlighted fields.", { staffId: [`${who} doesn't perform all of these services`] });
    case "staff_conflict": {
      const message = `${who} is already booked ${timeRange(failure.startsAt, failure.endsAt, prepared.timezone)}. Pick another time or team member.`;
      throw new AppError("CONFLICT", message, { staffId: [message] });
    }
  }
}

/** Validate, then insert. Returns the new id and the tenant-local date it landed on so the UI can show that day. */
export async function book(ctx: TenantContext, input: BookAppointmentInput, now = new Date()): Promise<{ id: string; date: string }> {
  repo.assertWritable();
  const prepared = await prepareBooking(ctx, input, now);
  const result = await repo.insertBooking(ctx.tenantId, prepared.write);
  if (!result.ok) throwBookingFailure(result, prepared);
  return { id: result.id, date: zonedDateString(prepared.write.startsAt, prepared.timezone) };
}

const NOT_EDITABLE = "Only booked appointments can be edited. Walk-ins and appointments already under way can't be rescheduled.";

/** The booking as the edit form needs it, with date and time on the tenant's wall clock. */
export async function getEditable(ctx: TenantContext, id: string): Promise<EditableAppointment> {
  const [appointment, timezone] = await Promise.all([repo.findById(ctx.tenantId, id), tenantTimezone(ctx.tenantId)]);
  if (!appointment) throw new AppError("NOT_FOUND", "Appointment not found.");
  if (!canEditAppointment(appointment)) throw new AppError("CONFLICT", NOT_EDITABLE);
  return {
    id: appointment.id,
    branchId: appointment.branchId,
    customerId: appointment.customerId,
    serviceIds: appointment.services.flatMap((line) => (line.serviceId ? [line.serviceId] : [])),
    staffId: appointment.staffId,
    date: zonedDateString(appointment.startsAt, timezone),
    time: zonedTimeString(appointment.startsAt, timezone),
    notes: appointment.notes,
  };
}

/**
 * Edit / reschedule a booking (never a walk-in, and only before check-in) with exactly the checks a new booking
 * gets: branch, services the branch offers, staff at that branch who perform them, availability and a free slot.
 */
export async function updateBooking(ctx: TenantContext, id: string, input: BookAppointmentInput, now = new Date()): Promise<{ date: string }> {
  repo.assertWritable();
  const existing = await repo.findById(ctx.tenantId, id);
  if (!existing) throw new AppError("NOT_FOUND", "Appointment not found.");
  if (!canEditAppointment(existing)) throw new AppError("CONFLICT", NOT_EDITABLE);

  const prepared = await prepareBooking(ctx, { ...input, type: "booking" }, now, existing.startsAt);
  const result = await repo.updateBooking(ctx.tenantId, id, prepared.write);
  if (!result.ok) {
    if (result.reason === "not_found") throw new AppError("NOT_FOUND", "Appointment not found.");
    if (result.reason === "not_editable") throw new AppError("CONFLICT", NOT_EDITABLE);
    throwBookingFailure(result, prepared);
  }
  return { date: zonedDateString(prepared.write.startsAt, prepared.timezone) };
}

// --- Status changes ----------------------------------------------------------------------------------

export async function changeStatus(ctx: TenantContext, input: ChangeAppointmentStatusInput, now = new Date()): Promise<void> {
  repo.assertWritable();
  const existing = await repo.findById(ctx.tenantId, input.id);
  if (!existing) throw new AppError("NOT_FOUND", "Appointment not found.");
  if (!canTransition(existing.status, input.status)) {
    throw new AppError("CONFLICT", `A ${APPOINTMENT_STATUS_LABELS[existing.status].toLowerCase()} appointment can't be marked ${APPOINTMENT_STATUS_LABELS[input.status].toLowerCase()}.`);
  }
  if (input.status === "no_show") {
    if (existing.type === "walk_in") throw new AppError("CONFLICT", "A walk-in can't be marked as a no-show. Cancel it instead.");
    if (!canMarkNoShow(existing, now)) throw new AppError("CONFLICT", "An appointment can only be marked as a no-show once its start time has passed.");
  }
  if (!(await repo.transitionStatus(ctx.tenantId, input.id, existing.status, input.status))) {
    throw new AppError("CONFLICT", "This appointment was just updated by someone else. Refresh to see the latest status.");
  }
}

/**
 * Permanently delete an appointment (not a status change). Its booked-service lines are removed with it; any
 * receipt or payment already recorded for it stays in billing history, just no longer linked to the appointment.
 * Returns the customer id so callers can refresh that profile.
 */
export async function deleteAppointment(ctx: TenantContext, id: string): Promise<{ customerId: string | null }> {
  repo.assertWritable();
  const existing = await repo.findById(ctx.tenantId, id);
  if (!existing) throw new AppError("NOT_FOUND", "Appointment not found.");
  if (!(await repo.deleteById(ctx.tenantId, id))) throw new AppError("NOT_FOUND", "Appointment not found.");
  return { customerId: existing.customerId };
}

// --- History & billing hand-off ----------------------------------------------------------------------

const CUSTOMER_HISTORY_LIMIT = 50;

/** A customer's appointments, newest first (profile visit history). */
export function listForCustomer(tenantId: string, customerId: string, limit = CUSTOMER_HISTORY_LIMIT) {
  return repo.listForCustomer(tenantId, customerId, limit);
}

/** Recently completed appointments; billing filters these down to the ones still unpaid. */
export function listCompleted(tenantId: string, limit = 100) {
  return repo.listCompleted(tenantId, limit);
}

/** One appointment with its service snapshot lines, or null if it isn't in this tenant. */
export function findAppointment(tenantId: string, id: string) {
  return repo.findById(tenantId, id);
}
