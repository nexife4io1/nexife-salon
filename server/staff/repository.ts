import "server-only";
import { and, asc, count, eq, ilike, inArray, isNotNull, or, type SQL } from "drizzle-orm";
import { DatabaseNotConfiguredError, isDatabaseConfigured, withTenant, type Transaction } from "@/db/client";
import { staff, staffBreaks, staffServices, staffWorkingHours } from "@/db/schema";
import { fixtureBranchActivity, fixtureBranches } from "@/db/seed/fixtures";
import type {
  StaffFilters,
  StaffGender,
  StaffJobRole,
  StaffMember,
  StaffSchedule,
  StaffStatus,
  StaffWrite,
} from "./schema";

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

// --- Staff management ------------------------------------------------------------------------------

/** Writes always need a real database; call first so demo mode fails before any fixture-only validation. */
export function assertWritable(): void {
  if (!isDatabaseConfigured()) throw new DatabaseNotConfiguredError();
}

export function dataSource(): "database" | "demo" {
  return isDatabaseConfigured() ? "database" : "demo";
}

export type StaffDirectoryRow = StaffMember & {
  status: StaffStatus;
  jobRole: StaffJobRole | null;
  schedule: StaffSchedule;
};

export type StaffProfileRow = StaffDirectoryRow & {
  serviceIds: string[];
  phone: string | null;
  gender: StaffGender | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  monthlySalaryCents: number | null;
  yearsExperience: number | null;
  joinedOn: string | null;
  casualLeaves: number | null;
  recruitmentSource: string | null;
  registrationCode: string | null;
};

/** Postgres `time` comes back as "HH:MM:SS"; the app works in "HH:MM". */
const hhmm = (t: string) => t.slice(0, 5);

const directoryColumns = {
  id: staff.id,
  branchId: staff.branchId,
  name: staff.name,
  initials: staff.initials,
  title: staff.title,
  active: staff.active,
  status: staff.status,
  jobRole: staff.jobRole,
  weeklyOffDay: staff.weeklyOffDay,
};

/** Schedules (hours + breaks) for the given staff, keyed by staff id. */
async function loadSchedules(tx: Transaction, tenantId: string, rows: { id: string; weeklyOffDay: number | null }[]): Promise<Map<string, StaffSchedule>> {
  const map = new Map<string, StaffSchedule>(rows.map((r) => [r.id, { weeklyOffDay: r.weeklyOffDay, hours: [], breaks: [] }]));
  const ids = rows.map((r) => r.id);
  if (!ids.length) return map;

  const hours = await tx
    .select()
    .from(staffWorkingHours)
    .where(and(eq(staffWorkingHours.tenantId, tenantId), inArray(staffWorkingHours.staffId, ids)))
    .orderBy(asc(staffWorkingHours.dayOfWeek));
  const breaks = await tx
    .select()
    .from(staffBreaks)
    .where(and(eq(staffBreaks.tenantId, tenantId), inArray(staffBreaks.staffId, ids)))
    .orderBy(asc(staffBreaks.startTime));

  for (const h of hours) map.get(h.staffId)?.hours.push({ day: h.dayOfWeek, start: hhmm(h.startTime), end: hhmm(h.endTime) });
  for (const b of breaks) map.get(b.staffId)?.breaks.push({ label: b.label, start: hhmm(b.startTime), end: hhmm(b.endTime) });
  return map;
}

/** Assigned service ids keyed by staff id; staff with none are absent. Omit `staffIds` for the whole tenant. */
async function loadServiceIds(tx: Transaction, tenantId: string, staffIds?: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (staffIds && !staffIds.length) return map;
  const rows = await tx
    .select({ staffId: staffServices.staffId, serviceId: staffServices.serviceId })
    .from(staffServices)
    .where(and(eq(staffServices.tenantId, tenantId), staffIds ? inArray(staffServices.staffId, staffIds) : undefined));
  for (const r of rows) map.set(r.staffId, [...(map.get(r.staffId) ?? []), r.serviceId]);
  return map;
}

/** Every staff member who has declared services, with those service ids. Booking uses it to narrow choices. */
export async function listServiceAssignments(tenantId: string): Promise<Map<string, string[]>> {
  if (!isDatabaseConfigured()) return new Map();
  return withTenant(tenantId, (tx) => loadServiceIds(tx, tenantId));
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Directory rows (no sensitive fields). Fixture mode carries no individual staff, so it is empty. */
export async function listDirectory(tenantId: string, filters: StaffFilters): Promise<StaffDirectoryRow[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, async (tx) => {
    const conditions: (SQL | undefined)[] = [eq(staff.tenantId, tenantId)];
    if (filters.branchId) conditions.push(eq(staff.branchId, filters.branchId));
    if (filters.status) conditions.push(eq(staff.status, filters.status));
    if (filters.q) {
      const pattern = `%${escapeLike(filters.q)}%`;
      conditions.push(or(ilike(staff.name, pattern), ilike(staff.title, pattern)));
    }
    const rows = await tx
      .select(directoryColumns)
      .from(staff)
      .where(and(...conditions))
      .orderBy(asc(staff.name), asc(staff.id));
    const schedules = await loadSchedules(tx, tenantId, rows);
    return rows.map(({ weeklyOffDay: _weeklyOffDay, ...row }) => ({ ...row, schedule: schedules.get(row.id)! }));
  });
}

export async function findProfile(tenantId: string, staffId: string): Promise<StaffProfileRow | null> {
  if (!isDatabaseConfigured()) return null;
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({
        ...directoryColumns,
        phone: staff.phone,
        gender: staff.gender,
        address: staff.address,
        emergencyContactName: staff.emergencyContactName,
        emergencyContactPhone: staff.emergencyContactPhone,
        monthlySalaryCents: staff.monthlySalaryCents,
        yearsExperience: staff.yearsExperience,
        joinedOn: staff.joinedOn,
        casualLeaves: staff.casualLeaves,
        recruitmentSource: staff.recruitmentSource,
        registrationCode: staff.registrationCode,
      })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .limit(1);
    if (!row) return null;

    const schedules = await loadSchedules(tx, tenantId, [row]);
    const serviceIds = (await loadServiceIds(tx, tenantId, [row.id])).get(row.id) ?? [];
    const { weeklyOffDay: _weeklyOffDay, ...rest } = row;
    return { ...rest, serviceIds, schedule: schedules.get(row.id)! };
  });
}

function profileColumns(input: StaffWrite) {
  return {
    name: input.name,
    initials: input.initials,
    title: input.title,
    branchId: input.branchId,
    jobRole: input.jobRole,
    status: input.status,
    // Legacy flag read by branch staff counts; always derived from status.
    active: input.status !== "inactive",
    phone: input.phone,
    gender: input.gender,
    address: input.address,
    emergencyContactName: input.emergencyContactName,
    emergencyContactPhone: input.emergencyContactPhone,
    monthlySalaryCents: input.monthlySalaryCents,
    yearsExperience: input.yearsExperience,
    joinedOn: input.joinedOn,
    casualLeaves: input.casualLeaves,
    recruitmentSource: input.recruitmentSource,
    weeklyOffDay: input.weeklyOffDay,
  };
}

/** Replace weekly hours, breaks and assigned services with exactly what `input` carries. */
async function replaceChildren(tx: Transaction, tenantId: string, staffId: string, input: StaffWrite) {
  await tx.delete(staffWorkingHours).where(and(eq(staffWorkingHours.tenantId, tenantId), eq(staffWorkingHours.staffId, staffId)));
  await tx.delete(staffBreaks).where(and(eq(staffBreaks.tenantId, tenantId), eq(staffBreaks.staffId, staffId)));
  await tx.delete(staffServices).where(and(eq(staffServices.tenantId, tenantId), eq(staffServices.staffId, staffId)));
  if (input.serviceIds.length) {
    await tx.insert(staffServices).values(input.serviceIds.map((serviceId) => ({ tenantId, staffId, serviceId })));
  }

  if (input.hours.length) {
    await tx.insert(staffWorkingHours).values(input.hours.map((h) => ({ tenantId, staffId, dayOfWeek: h.day, startTime: h.start, endTime: h.end })));
  }
  if (input.breaks.length) {
    await tx.insert(staffBreaks).values(input.breaks.map((b) => ({ tenantId, staffId, label: b.label, startTime: b.start, endTime: b.end })));
  }
}

export async function insertStaff(tenantId: string, input: StaffWrite): Promise<string> {
  assertWritable();
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .insert(staff)
      .values({ tenantId, ...profileColumns(input) })
      .returning({ id: staff.id });
    await replaceChildren(tx, tenantId, row!.id, input);
    return row!.id;
  });
}

/** Returns false when no such staff member exists in this tenant. */
export async function updateStaff(tenantId: string, staffId: string, input: StaffWrite): Promise<boolean> {
  assertWritable();
  return withTenant(tenantId, async (tx) => {
    const updated = await tx
      .update(staff)
      .set(profileColumns(input))
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .returning({ id: staff.id });
    if (!updated.length) return false;
    await replaceChildren(tx, tenantId, staffId, input);
    return true;
  });
}

/** Returns false when no such staff member exists in this tenant. */
export async function setStatus(tenantId: string, staffId: string, status: StaffStatus): Promise<boolean> {
  assertWritable();
  const updated = await withTenant(tenantId, (tx) =>
    tx
      .update(staff)
      .set({ status, active: status !== "inactive" })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .returning({ id: staff.id }),
  );
  return updated.length > 0;
}

// --- Device registration ---------------------------------------------------------------------------

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === UNIQUE_VIOLATION || e?.cause?.code === UNIQUE_VIOLATION;
}

export type SetCodeResult = "ok" | "not_found" | "no_branch" | "taken";

/** Stores `code` for a staff member of this tenant that is assigned to a branch. "taken" = another staff member has it. */
export async function setRegistrationCode(tenantId: string, staffId: string, code: string): Promise<SetCodeResult> {
  assertWritable();
  try {
    return await withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select({ branchId: staff.branchId })
        .from(staff)
        .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
        .limit(1);
      if (!row) return "not_found" as const;
      if (!row.branchId) return "no_branch" as const;
      await tx
        .update(staff)
        .set({ registrationCode: code })
        .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));
      return "ok" as const;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "taken";
    throw error;
  }
}

export type DeviceStaffRow = { id: string; name: string; branchId: string | null; status: StaffStatus; phone: string | null };

export async function findByRegistrationCode(tenantId: string, code: string): Promise<DeviceStaffRow | null> {
  if (!isDatabaseConfigured()) return null;
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({ id: staff.id, name: staff.name, branchId: staff.branchId, status: staff.status, phone: staff.phone })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.registrationCode, code)))
      .limit(1);
    return row ?? null;
  });
}
