import "server-only";
import { and, asc, count, eq, ilike, inArray, isNotNull, or, type SQL } from "drizzle-orm";
import { DatabaseNotConfiguredError, isDatabaseConfigured, withTenant, type Transaction } from "@/db/client";
import { staff, staffBreaks, staffWorkingHours } from "@/db/schema";
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
      })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .limit(1);
    if (!row) return null;

    const schedules = await loadSchedules(tx, tenantId, [row]);
    const { weeklyOffDay: _weeklyOffDay, ...rest } = row;
    return { ...rest, schedule: schedules.get(row.id)! };
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

/** Replace weekly hours and breaks with exactly what `input` carries. */
async function replaceChildren(tx: Transaction, tenantId: string, staffId: string, input: StaffWrite) {
  await tx.delete(staffWorkingHours).where(and(eq(staffWorkingHours.tenantId, tenantId), eq(staffWorkingHours.staffId, staffId)));
  await tx.delete(staffBreaks).where(and(eq(staffBreaks.tenantId, tenantId), eq(staffBreaks.staffId, staffId)));

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
