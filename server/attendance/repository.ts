import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { DatabaseNotConfiguredError, isDatabaseConfigured, withTenant } from "@/db/client";
import { branches, staff, staffAttendance, staffLeaves, staffWorkingHours } from "@/db/schema";
import type { AddShiftInput, AttendanceBoard, CreateLeaveInput, RecordAttendanceInput } from "./schema";

export function dataSource(): "database" | "demo" {
  return isDatabaseConfigured() ? "database" : "demo";
}

export function assertWritable(): void {
  if (!isDatabaseConfigured()) throw new DatabaseNotConfiguredError();
}

const hhmm = (value: string) => value.slice(0, 5);

export async function getBoard(tenantId: string, date: string, day: number): Promise<AttendanceBoard> {
  if (!isDatabaseConfigured()) return { date, day, staff: [], leaves: [], source: "demo" };

  return withTenant(tenantId, async (tx) => {
    const staffRows = await tx
      .select({ id: staff.id, name: staff.name, branchName: branches.name })
      .from(staff)
      .leftJoin(branches, and(eq(branches.id, staff.branchId), eq(branches.tenantId, tenantId)))
      .where(and(eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .orderBy(asc(staff.name));
    const staffIds = staffRows.map((row) => row.id);
    if (!staffIds.length) return { date, day, staff: [], leaves: [], source: "database" };

    const [shiftRows, attendanceRows, leaveRows] = await Promise.all([
      tx
        .select({
          id: staffWorkingHours.id,
          staffId: staffWorkingHours.staffId,
          start: staffWorkingHours.startTime,
          end: staffWorkingHours.endTime,
        })
        .from(staffWorkingHours)
        .where(and(eq(staffWorkingHours.tenantId, tenantId), eq(staffWorkingHours.dayOfWeek, day), inArray(staffWorkingHours.staffId, staffIds)))
        .orderBy(asc(staffWorkingHours.startTime)),
      tx
        .select()
        .from(staffAttendance)
        .where(and(eq(staffAttendance.tenantId, tenantId), eq(staffAttendance.workDate, date), inArray(staffAttendance.staffId, staffIds))),
      tx
        .select({
          id: staffLeaves.id,
          staffId: staffLeaves.staffId,
          fromDate: staffLeaves.fromDate,
          toDate: staffLeaves.toDate,
          reason: staffLeaves.reason,
        })
        .from(staffLeaves)
        .where(and(eq(staffLeaves.tenantId, tenantId), lte(staffLeaves.fromDate, date), gte(staffLeaves.toDate, date), inArray(staffLeaves.staffId, staffIds))),
    ]);

    const attendanceByShift = new Map(
      attendanceRows.filter((row) => row.shiftId).map((row) => [row.shiftId!, row]),
    );
    const leavesByStaff = new Map(leaveRows.map((leave) => [leave.staffId, leave]));
    const nameByStaff = new Map(staffRows.map((row) => [row.id, row.name]));
    return {
      date,
      day,
      staff: staffRows.map((member) => {
        const leave = leavesByStaff.get(member.id);
        return {
          ...member,
          shifts: shiftRows
            .filter((shift) => shift.staffId === member.id)
            .map((shift) => {
              const record = attendanceByShift.get(shift.id);
              return {
                id: shift.id,
                start: hhmm(shift.start),
                end: hhmm(shift.end),
                attendance: record
                  ? {
                      id: record.id,
                      shiftId: record.shiftId,
                      shiftStart: hhmm(record.shiftStart),
                      shiftEnd: hhmm(record.shiftEnd),
                      clockIn: hhmm(record.clockIn),
                      clockOut: record.clockOut ? hhmm(record.clockOut) : null,
                      note: record.note,
                    }
                  : null,
              };
            }),
          leave: leave ? { id: leave.id, reason: leave.reason } : null,
        };
      }),
      leaves: leaveRows.map((leave) => ({
        ...leave,
        staffName: nameByStaff.get(leave.staffId) ?? "Staff member",
      })),
      source: "database",
    };
  });
}

export async function getActiveStaff(tenantId: string): Promise<{ id: string; name: string; weeklyOffDay: number | null }[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, (tx) =>
    tx
      .select({ id: staff.id, name: staff.name, weeklyOffDay: staff.weeklyOffDay })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.active, true)))
      .orderBy(asc(staff.name)),
  );
}

export async function getShiftsForStaff(tenantId: string, staffId: string, day: number) {
  return withTenant(tenantId, (tx) =>
    tx
      .select({ id: staffWorkingHours.id, start: staffWorkingHours.startTime, end: staffWorkingHours.endTime })
      .from(staffWorkingHours)
      .where(and(eq(staffWorkingHours.tenantId, tenantId), eq(staffWorkingHours.staffId, staffId), eq(staffWorkingHours.dayOfWeek, day)))
      .orderBy(asc(staffWorkingHours.startTime)),
  );
}

export async function addShift(tenantId: string, input: AddShiftInput): Promise<boolean> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .insert(staffWorkingHours)
      .values({ tenantId, staffId: input.staffId, dayOfWeek: input.day, startTime: input.start, endTime: input.end })
      .onConflictDoNothing()
      .returning({ id: staffWorkingHours.id }),
  );
  return rows.length > 0;
}

export async function removeShift(tenantId: string, shiftId: string): Promise<{ removed: boolean; hasAttendance: boolean }> {
  return withTenant(tenantId, async (tx) => {
    const [attendance] = await tx
      .select({ id: staffAttendance.id })
      .from(staffAttendance)
      .where(and(eq(staffAttendance.tenantId, tenantId), eq(staffAttendance.shiftId, shiftId)))
      .limit(1);
    if (attendance) return { removed: false, hasAttendance: true };
    const rows = await tx
      .delete(staffWorkingHours)
      .where(and(eq(staffWorkingHours.tenantId, tenantId), eq(staffWorkingHours.id, shiftId)))
      .returning({ id: staffWorkingHours.id });
    return { removed: rows.length > 0, hasAttendance: false };
  });
}

export async function getShiftForDate(tenantId: string, staffId: string, shiftId: string, day: number) {
  return withTenant(tenantId, async (tx) => {
    const [member] = await tx
      .select({ id: staff.id, active: staff.active })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .limit(1);
    if (!member) return { member: null, shift: null };
    const [shift] = await tx
      .select({ id: staffWorkingHours.id, start: staffWorkingHours.startTime, end: staffWorkingHours.endTime })
      .from(staffWorkingHours)
      .where(and(eq(staffWorkingHours.tenantId, tenantId), eq(staffWorkingHours.staffId, staffId), eq(staffWorkingHours.id, shiftId), eq(staffWorkingHours.dayOfWeek, day)))
      .limit(1);
    return { member, shift: shift ?? null };
  });
}

export async function recordAttendance(tenantId: string, userId: string, input: RecordAttendanceInput, shift: { start: string; end: string }) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .insert(staffAttendance)
      .values({
        tenantId,
        staffId: input.staffId,
        shiftId: input.shiftId,
        workDate: input.workDate,
        shiftStart: shift.start,
        shiftEnd: shift.end,
        clockIn: input.clockIn,
        clockOut: input.clockOut || null,
        note: input.note || null,
        recordedBy: userId,
      })
      .onConflictDoUpdate({
        target: [staffAttendance.tenantId, staffAttendance.staffId, staffAttendance.workDate, staffAttendance.shiftStart],
        set: {
          shiftId: input.shiftId,
          shiftEnd: shift.end,
          clockIn: input.clockIn,
          clockOut: input.clockOut || null,
          note: input.note || null,
          recordedBy: userId,
          updatedAt: new Date(),
        },
      })
      .returning({ id: staffAttendance.id }),
  );
  return row!.id;
}

export async function createLeave(tenantId: string, userId: string, input: CreateLeaveInput): Promise<string> {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .insert(staffLeaves)
      .values({
        tenantId,
        staffId: input.staffId,
        fromDate: input.fromDate,
        toDate: input.toDate,
        reason: input.reason || null,
        recordedBy: userId,
      })
      .returning({ id: staffLeaves.id }),
  );
  return row!.id;
}

export async function removeLeave(tenantId: string, leaveId: string): Promise<boolean> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .delete(staffLeaves)
      .where(and(eq(staffLeaves.tenantId, tenantId), eq(staffLeaves.id, leaveId)))
      .returning({ id: staffLeaves.id }),
  );
  return rows.length > 0;
}
