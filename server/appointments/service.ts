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
  canTransition,
  type AppointmentBoard,
  type AppointmentFilters,
  type AppointmentStatus,
  type BookAppointmentInput,
  type BookingOptions,
  type ChangeAppointmentStatusInput,
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

  return {
    date,
    today,
    timezone,
    filters: { ...filters, date },
    appointments: filters.status ? dayRows.filter((row) => row.status === filters.status) : dayRows,
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
  const [tenant, overview, services, staff, customers] = await Promise.all([
    tenantsService.getTenant(ctx.tenantId),
    branchesService.getOverview(ctx.tenantId),
    tenantsService.listTenantServices(ctx.tenantId),
    staffService.listStaff(ctx.tenantId),
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
    customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    source: repo.dataSource(),
  };
}

function timeRange(a: Date, b: Date, timezone: string): string {
  return `${zonedTimeString(a, timezone)}–${zonedTimeString(b, timezone)}`;
}

/**
 * Validate everything the booking points at (all of it must belong to this tenant, and fit together), then
 * insert. Returns the new id and the tenant-local date it landed on so the UI can show that day.
 */
export async function book(ctx: TenantContext, input: BookAppointmentInput, now = new Date()): Promise<{ id: string; date: string }> {
  repo.assertWritable();
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
    else if (at.getTime() < now.getTime() - PAST_GRACE_MS) fail("time", "Choose a time that hasn't passed");
    else startsAt = at;
  }

  if (Object.keys(errors).length) throw new AppError("VALIDATION", "Please fix the highlighted fields.", errors);

  const result = await repo.insertBooking(ctx.tenantId, {
    branchId: input.branchId,
    customerId: input.customerId ?? null,
    lines: chosen.map((s) => ({ serviceId: s!.id, name: s!.name, priceCents: s!.priceCents, durationMinutes: s!.durationMinutes })),
    staffId: input.staffId ?? null,
    startsAt,
    type: input.type,
    notes: input.notes ?? null,
  });

  if (!result.ok) {
    switch (result.reason) {
      case "customer_not_found":
        throw new AppError("VALIDATION", "Please fix the highlighted fields.", { customerId: ["Choose one of your customers"] });
      case "staff_not_qualified":
        throw new AppError("VALIDATION", "Please fix the highlighted fields.", { staffId: [`${staffName ?? "That team member"} doesn't perform all of these services`] });
      case "staff_conflict": {
        const message = `${staffName ?? "That team member"} is already booked ${timeRange(result.startsAt, result.endsAt, tenant.timezone)}. Pick another time or team member.`;
        throw new AppError("CONFLICT", message, { staffId: [message] });
      }
    }
  }
  return { id: result.id, date: zonedDateString(startsAt, tenant.timezone) };
}

// --- Status changes ----------------------------------------------------------------------------------

export async function changeStatus(ctx: TenantContext, input: ChangeAppointmentStatusInput): Promise<void> {
  repo.assertWritable();
  const existing = await repo.findById(ctx.tenantId, input.id);
  if (!existing) throw new AppError("NOT_FOUND", "Appointment not found.");
  if (!canTransition(existing.status, input.status)) {
    throw new AppError("CONFLICT", `A ${APPOINTMENT_STATUS_LABELS[existing.status].toLowerCase()} appointment can't be marked ${APPOINTMENT_STATUS_LABELS[input.status].toLowerCase()}.`);
  }
  if (!(await repo.transitionStatus(ctx.tenantId, input.id, existing.status, input.status))) {
    throw new AppError("CONFLICT", "This appointment was just updated by someone else. Refresh to see the latest status.");
  }
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
