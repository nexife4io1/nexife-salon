import { describe, expect, it } from "vitest";
import { addShiftSchema, createLeaveSchema, getShiftAttendanceStatus, recordAttendanceSchema } from "@/server/attendance/schema";

const STAFF = "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01";
const SHIFT = "2b4c9f62-1d0a-4e1b-9a55-2b6f0c1e0a02";

describe("attendance input schemas", () => {
  it("allows multiple independently scheduled shifts but validates each shift interval", () => {
    expect(addShiftSchema.safeParse({ staffId: STAFF, day: "3", start: "09:00", end: "13:00" }).success).toBe(true);
    expect(addShiftSchema.safeParse({ staffId: STAFF, day: "7", start: "09:00", end: "13:00" }).success).toBe(false);
    expect(addShiftSchema.safeParse({ staffId: STAFF, day: "3", start: "14:00", end: "09:00" }).success).toBe(false);
  });

  it("validates attendance and leave dates/times", () => {
    expect(recordAttendanceSchema.safeParse({ staffId: STAFF, shiftId: SHIFT, workDate: "2026-10-14", clockIn: "09:02", clockOut: "12:00" }).success).toBe(true);
    expect(recordAttendanceSchema.safeParse({ staffId: STAFF, shiftId: SHIFT, workDate: "2026-02-30", clockIn: "09:02", clockOut: "09:00" }).success).toBe(false);
    expect(createLeaveSchema.safeParse({ staffId: STAFF, fromDate: "2026-10-15", toDate: "2026-10-14" }).success).toBe(false);
  });
});

describe("getShiftAttendanceStatus", () => {
  it("uses actual attendance before dated leave and does not invent a status", () => {
    expect(getShiftAttendanceStatus(true, true)).toBe("present");
    expect(getShiftAttendanceStatus(false, true)).toBe("leave");
    expect(getShiftAttendanceStatus(false, false)).toBe("unmarked");
  });
});
