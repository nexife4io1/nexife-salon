import "server-only";
import { and, count, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { DatabaseNotConfiguredError, getDb, isDatabaseConfigured, withTenant } from "@/db/client";
import { staffAttendance, staffLoginAttempts } from "@/db/schema";
import type { AttendanceRecord } from "./schema";

/** Attendance is a write-heavy feature with no fixture data: demo mode reads empty and refuses writes. */
export function assertWritable(): void {
  if (!isDatabaseConfigured()) throw new DatabaseNotConfiguredError();
}

const columns = {
  id: staffAttendance.id,
  workDate: staffAttendance.workDate,
  checkInAt: staffAttendance.checkInAt,
  checkOutAt: staffAttendance.checkOutAt,
};

type Row = { id: string; workDate: string; checkInAt: Date; checkOutAt: Date | null };

const toRecord = (row: Row): AttendanceRecord => ({
  id: row.id,
  workDate: row.workDate,
  checkInAt: row.checkInAt.toISOString(),
  checkOutAt: row.checkOutAt?.toISOString() ?? null,
});

export async function findForDay(tenantId: string, staffId: string, workDate: string): Promise<AttendanceRecord | null> {
  if (!isDatabaseConfigured()) return null;
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select(columns)
      .from(staffAttendance)
      .where(and(eq(staffAttendance.tenantId, tenantId), eq(staffAttendance.staffId, staffId), eq(staffAttendance.workDate, workDate)))
      .limit(1),
  );
  return row ? toRecord(row) : null;
}

/** Returns null when the staff member already has a record for `workDate` (the unique index decides, so races are safe). */
export async function insertCheckIn(
  tenantId: string,
  input: { staffId: string; branchId: string | null; workDate: string; at: Date },
): Promise<AttendanceRecord | null> {
  assertWritable();
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .insert(staffAttendance)
      .values({ tenantId, staffId: input.staffId, branchId: input.branchId, workDate: input.workDate, checkInAt: input.at })
      .onConflictDoNothing({ target: [staffAttendance.staffId, staffAttendance.workDate] })
      .returning(columns),
  );
  return row ? toRecord(row) : null;
}

/** Returns null when there is no open (not yet checked-out) record for `workDate`. */
export async function setCheckOut(tenantId: string, staffId: string, workDate: string, at: Date): Promise<AttendanceRecord | null> {
  assertWritable();
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .update(staffAttendance)
      .set({ checkOutAt: at })
      .where(
        and(
          eq(staffAttendance.tenantId, tenantId),
          eq(staffAttendance.staffId, staffId),
          eq(staffAttendance.workDate, workDate),
          // Never overwrite an existing check-out.
          isNull(staffAttendance.checkOutAt),
        ),
      )
      .returning(columns),
  );
  return row ? toRecord(row) : null;
}

export async function listForStaff(tenantId: string, staffId: string, limit: number): Promise<AttendanceRecord[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select(columns)
      .from(staffAttendance)
      .where(and(eq(staffAttendance.tenantId, tenantId), eq(staffAttendance.staffId, staffId)))
      .orderBy(desc(staffAttendance.workDate))
      .limit(limit),
  );
  return rows.map(toRecord);
}

// --- Login throttling (database-backed; no in-memory state) ----------------------------------------

export async function countRecentFailures(key: string, since: Date): Promise<number> {
  assertWritable();
  const [row] = await getDb()
    .select({ total: count() })
    .from(staffLoginAttempts)
    .where(and(eq(staffLoginAttempts.key, key), gte(staffLoginAttempts.attemptedAt, since)));
  return row?.total ?? 0;
}

export async function recordFailure(key: string, now: Date, keepSince: Date): Promise<void> {
  assertWritable();
  const db = getDb();
  await db.insert(staffLoginAttempts).values({ key, attemptedAt: now });
  // Housekeeping so the table stays small: drop rows nobody can still be throttled by.
  await db.delete(staffLoginAttempts).where(lt(staffLoginAttempts.attemptedAt, keepSince));
}
