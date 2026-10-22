import "server-only";
import type { TenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
import { isValidDateString, zonedDateString } from "@/lib/dates";
import * as tenantsService from "@/server/tenants/service";
import * as repo from "./repository";
import type { AddShiftInput, CreateLeaveInput, RecordAttendanceInput } from "./schema";

function assertCanManage(ctx: TenantContext): void {
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    throw new AppError("FORBIDDEN", "Only owners and managers can manage attendance.");
  }
}

const dayForDate = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const hhmm = (time: string) => time.slice(0, 5);

export async function getOverview(ctx: TenantContext, rawDate?: string): Promise<{
  board: Awaited<ReturnType<typeof repo.getBoard>>;
  staffOptions: Awaited<ReturnType<typeof repo.getActiveStaff>>;
  timezone: string;
}> {
  assertCanManage(ctx);
  const tenant = await tenantsService.getTenant(ctx.tenantId);
  const date = rawDate && isValidDateString(rawDate) ? rawDate : zonedDateString(new Date(), tenant.timezone);
  const day = dayForDate(date);
  const [board, staffOptions] = await Promise.all([
    repo.getBoard(ctx.tenantId, date, day),
    repo.getActiveStaff(ctx.tenantId),
  ]);
  return { board, staffOptions, timezone: tenant.timezone };
}

export async function addRecurringShift(ctx: TenantContext, input: AddShiftInput): Promise<void> {
  assertCanManage(ctx);
  repo.assertWritable();
  const [member] = (await repo.getActiveStaff(ctx.tenantId)).filter((row) => row.id === input.staffId);
  if (!member) throw new AppError("NOT_FOUND", "Active staff member not found.");
  if (member.weeklyOffDay === input.day) {
    throw new AppError("VALIDATION", "Choose a working day for this shift.", { day: ["This is the staff member's weekly day off."] });
  }

  const existing = await repo.getShiftsForStaff(ctx.tenantId, input.staffId, input.day);
  const overlaps = existing.some((shift) => minutes(input.start) < minutes(hhmm(shift.end)) && minutes(input.end) > minutes(hhmm(shift.start)));
  if (overlaps) throw new AppError("CONFLICT", "This shift overlaps an existing shift for that weekday.");
  if (!(await repo.addShift(ctx.tenantId, input))) {
    throw new AppError("CONFLICT", "A shift already exists with this start time.");
  }
}

export async function removeRecurringShift(ctx: TenantContext, shiftId: string): Promise<void> {
  assertCanManage(ctx);
  repo.assertWritable();
  const result = await repo.removeShift(ctx.tenantId, shiftId);
  if (result.hasAttendance) throw new AppError("CONFLICT", "This shift has attendance history and cannot be removed.");
  if (!result.removed) throw new AppError("NOT_FOUND", "Shift not found.");
}

export async function recordAttendance(ctx: TenantContext, input: RecordAttendanceInput): Promise<void> {
  assertCanManage(ctx);
  repo.assertWritable();
  const { member, shift } = await repo.getShiftForDate(ctx.tenantId, input.staffId, input.shiftId, dayForDate(input.workDate));
  if (!member?.active) throw new AppError("NOT_FOUND", "Active staff member not found.");
  if (!shift) throw new AppError("NOT_FOUND", "Scheduled shift not found for this staff member and date.");
  await repo.recordAttendance(ctx.tenantId, ctx.userId, input, { start: hhmm(shift.start), end: hhmm(shift.end) });
}

export async function createLeave(ctx: TenantContext, input: CreateLeaveInput): Promise<void> {
  assertCanManage(ctx);
  repo.assertWritable();
  const staffOptions = await repo.getActiveStaff(ctx.tenantId);
  if (!staffOptions.some((member) => member.id === input.staffId)) throw new AppError("NOT_FOUND", "Active staff member not found.");
  await repo.createLeave(ctx.tenantId, ctx.userId, input);
}

export async function removeLeave(ctx: TenantContext, leaveId: string): Promise<void> {
  assertCanManage(ctx);
  repo.assertWritable();
  if (!(await repo.removeLeave(ctx.tenantId, leaveId))) throw new AppError("NOT_FOUND", "Leave record not found.");
}

export const dataSource = repo.dataSource;
