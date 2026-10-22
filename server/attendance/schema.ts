import { z } from "zod";
import { isValidDateString, isValidTimeString } from "@/lib/dates";

const dateSchema = z.string().refine(isValidDateString, "Enter a valid date");
const timeSchema = z.string().refine(isValidTimeString, "Enter a valid time");

export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const addShiftSchema = z
  .object({
    staffId: z.string().uuid(),
    day: z.coerce.number().int().min(0).max(6),
    start: timeSchema,
    end: timeSchema,
  })
  .refine((value) => value.start < value.end, { message: "Shift end must be after its start", path: ["end"] });
export type AddShiftInput = z.infer<typeof addShiftSchema>;

export const removeShiftSchema = z.object({ shiftId: z.string().uuid() });

export const recordAttendanceSchema = z
  .object({
    staffId: z.string().uuid(),
    shiftId: z.string().uuid(),
    workDate: dateSchema,
    clockIn: timeSchema,
    clockOut: timeSchema.or(z.literal("")).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((value) => !value.clockOut || value.clockOut >= value.clockIn, {
    message: "Clock-out must be at or after clock-in",
    path: ["clockOut"],
  });
export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;

export const createLeaveSchema = z
  .object({
    staffId: z.string().uuid(),
    fromDate: dateSchema,
    toDate: dateSchema,
    reason: z.string().trim().max(300).optional(),
  })
  .refine((value) => value.fromDate <= value.toDate, {
    message: "Leave end date must be on or after its start date",
    path: ["toDate"],
  });
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;

export const removeLeaveSchema = z.object({ leaveId: z.string().uuid() });

export type AttendanceEntry = {
  id: string;
  shiftId: string | null;
  shiftStart: string;
  shiftEnd: string;
  clockIn: string;
  clockOut: string | null;
  note: string | null;
};

export type AttendanceShift = {
  id: string;
  start: string;
  end: string;
  attendance: AttendanceEntry | null;
};

export type AttendanceLeave = {
  id: string;
  staffId: string;
  staffName: string;
  fromDate: string;
  toDate: string;
  reason: string | null;
};

export type AttendanceStaff = {
  id: string;
  name: string;
  branchName: string | null;
  shifts: AttendanceShift[];
  leave: { id: string; reason: string | null } | null;
};

export type AttendanceBoard = {
  date: string;
  day: number;
  staff: AttendanceStaff[];
  leaves: AttendanceLeave[];
  source: "database" | "demo";
};

export type ShiftAttendanceStatus = "present" | "leave" | "unmarked";

export function getShiftAttendanceStatus(hasAttendance: boolean, onLeave: boolean): ShiftAttendanceStatus {
  if (hasAttendance) return "present";
  return onLeave ? "leave" : "unmarked";
}
