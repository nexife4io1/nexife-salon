import "server-only";
import { zonedDateString } from "@/lib/dates";
import type { TenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
// Cross-domain reads go through other domains' services — never their repositories.
import * as branchesService from "@/server/branches/service";
import * as staffService from "@/server/staff/service";
import * as tenantsService from "@/server/tenants/service";
import * as repo from "./repository";
import type { AttendanceActionKind, AttendanceCredentials, AttendanceRecord, AttendanceSession } from "./schema";
import { normalizePhone } from "./schema";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LIST_LIMIT = 60;

/** One message for every credential failure so the page never reveals which part was wrong. */
const BAD_CREDENTIALS = "Those details do not match our records. Check your salon code, registration code and mobile number.";

type Resolved = {
  tenant: { id: string; name: string; timezone: string };
  staff: { id: string; name: string; branchId: string | null };
};

/**
 * Authenticate a device user from salon code + registration code + phone. The tenant and staff ids come
 * from the database, never from the client. Failed attempts are throttled per salon code and caller.
 */
async function resolve(creds: AttendanceCredentials, caller: string, now: Date): Promise<Resolved> {
  repo.assertWritable();
  const key = `${creds.salonCode}|${caller}`;
  const since = new Date(now.getTime() - WINDOW_MS);
  if ((await repo.countRecentFailures(key, since)) >= MAX_FAILURES) {
    throw new AppError("FORBIDDEN", "Too many attempts. Please wait a few minutes and try again.");
  }

  const fail = async (): Promise<never> => {
    await repo.recordFailure(key, now, since);
    throw new AppError("UNAUTHENTICATED", BAD_CREDENTIALS);
  };

  const tenant = await tenantsService.findTenantBySlug(creds.salonCode);
  if (!tenant) return fail();
  const member = await staffService.findByRegistrationCode(tenant.id, creds.registrationCode);
  if (!member?.phone || normalizePhone(member.phone) !== creds.phone) return fail();
  if (member.status !== "active") throw new AppError("FORBIDDEN", "Your profile is not active. Please speak to your manager.");
  if (!member.branchId) throw new AppError("FORBIDDEN", "You are not assigned to a branch yet. Please speak to your manager.");

  return {
    tenant: { id: tenant.id, name: tenant.name, timezone: tenant.timezone },
    staff: { id: member.id, name: member.name, branchId: member.branchId },
  };
}

async function buildSession(r: Resolved, now: Date, record?: AttendanceRecord | null): Promise<AttendanceSession> {
  const today = zonedDateString(now, r.tenant.timezone);
  const branch = r.staff.branchId ? await branchesService.getBranch(r.tenant.id, r.staff.branchId).catch(() => null) : null;
  return {
    staffName: r.staff.name,
    branchName: branch?.name ?? null,
    salonName: r.tenant.name,
    timezone: r.tenant.timezone,
    today,
    record: record === undefined ? await repo.findForDay(r.tenant.id, r.staff.id, today) : record,
  };
}

export async function login(creds: AttendanceCredentials, caller: string, now = new Date()): Promise<AttendanceSession> {
  return buildSession(await resolve(creds, caller, now), now);
}

/** Record today's check-in or check-out for the authenticated staff member. */
export async function mark(creds: AttendanceCredentials, kind: AttendanceActionKind, caller: string, now = new Date()): Promise<AttendanceSession> {
  const r = await resolve(creds, caller, now);
  const workDate = zonedDateString(now, r.tenant.timezone);

  if (kind === "check_in") {
    const record = await repo.insertCheckIn(r.tenant.id, { staffId: r.staff.id, branchId: r.staff.branchId, workDate, at: now });
    if (!record) throw new AppError("CONFLICT", "You have already recorded attendance for today.");
    return buildSession(r, now, record);
  }

  const existing = await repo.findForDay(r.tenant.id, r.staff.id, workDate);
  if (!existing) throw new AppError("CONFLICT", "Record your attendance before checking out.");
  const record = await repo.setCheckOut(r.tenant.id, r.staff.id, workDate, now);
  if (!record) throw new AppError("CONFLICT", "You have already checked out for today.");
  return buildSession(r, now, record);
}

// --- Staff management ------------------------------------------------------------------------------

export type StaffAttendanceView = { salonCode: string; timezone: string; records: AttendanceRecord[] };

/** Recent attendance for one staff member of the caller's tenant. Managers only, like the rest of the profile. */
export async function listForStaff(ctx: TenantContext, staffId: string): Promise<StaffAttendanceView> {
  if (!staffService.canManageStaff(ctx)) throw new AppError("FORBIDDEN", "Only owners and managers can view attendance.");
  const [tenant, records] = await Promise.all([tenantsService.getTenant(ctx.tenantId), repo.listForStaff(ctx.tenantId, staffId, LIST_LIMIT)]);
  return { salonCode: tenant.slug, timezone: tenant.timezone, records };
}
