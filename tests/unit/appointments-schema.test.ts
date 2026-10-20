import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  isValidDateString,
  zonedDateString,
  zonedDayRange,
  zonedTimeString,
  zonedTimeToUtc,
} from "@/lib/dates";
import {
  appointmentsHref,
  bookAppointmentInputSchema,
  canTransition,
  changeAppointmentStatusInputSchema,
  parseAppointmentFilters,
} from "@/server/appointments/schema";

const BRANCH = "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01";
const SERVICE = "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a02";

describe("tenant timezone helpers", () => {
  it("converts wall-clock time to the right UTC instant", () => {
    expect(zonedTimeToUtc("2026-10-20", "09:00", "Asia/Kolkata")?.toISOString()).toBe("2026-10-20T03:30:00.000Z");
    expect(zonedTimeToUtc("2026-10-20", "09:00", "America/Los_Angeles")?.toISOString()).toBe("2026-10-20T16:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-20", "09:00", "America/Los_Angeles")?.toISOString()).toBe("2026-12-20T17:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-20", "09:00", "Not/AZone")?.toISOString()).toBe("2026-10-20T09:00:00.000Z");
  });

  it("returns null for DST-skipped and malformed times", () => {
    expect(zonedTimeToUtc("2027-03-14", "02:30", "America/New_York")).toBeNull();
    expect(zonedTimeToUtc("2026-10-20", "25:00", "UTC")).toBeNull();
    expect(zonedTimeToUtc("2026-02-30", "10:00", "UTC")).toBeNull();
  });

  it("picks the earlier instant for a repeated DST hour", () => {
    expect(zonedTimeToUtc("2026-11-01", "01:30", "America/New_York")?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("formats an instant on the tenant's wall clock", () => {
    const at = new Date("2026-10-17T03:15:00Z");
    expect(zonedDateString(at, "America/Los_Angeles")).toBe("2026-10-16");
    expect(zonedTimeString(at, "America/Los_Angeles")).toBe("20:15");
    expect(zonedDateString(at, "UTC")).toBe("2026-10-17");
  });

  it("builds day ranges that are 23h / 25h on DST days", () => {
    const hours = ({ start, end }: { start: Date; end: Date }) => (end.getTime() - start.getTime()) / 3_600_000;
    expect(hours(zonedDayRange("2026-10-20", "America/New_York"))).toBe(24);
    expect(hours(zonedDayRange("2027-03-14", "America/New_York"))).toBe(23);
    expect(hours(zonedDayRange("2026-11-01", "America/New_York"))).toBe(25);
    expect(zonedDayRange("2026-10-20", "Asia/Kolkata").start.toISOString()).toBe("2026-10-19T18:30:00.000Z");
  });

  it("does calendar math on date strings", () => {
    expect(addDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateString("2026-03-01", -1)).toBe("2026-02-28");
    expect(isValidDateString("2026-02-29")).toBe(false);
  });
});

describe("bookAppointmentInputSchema", () => {
  it("treats blank optional fields as absent and defaults to a booking", () => {
    const parsed = bookAppointmentInputSchema.parse({ branchId: BRANCH, serviceId: SERVICE, customerId: BRANCH, staffId: "", date: "2026-10-20", time: "10:00", notes: "  ", type: "" });
    expect(parsed).toMatchObject({ type: "booking", staffId: undefined, notes: undefined });
  });

  it("rejects malformed ids, dates, times and long notes", () => {
    const r = bookAppointmentInputSchema.safeParse({ branchId: "x", serviceId: "", customerId: BRANCH, date: "20/10/2026", time: "9am", notes: "n".repeat(501) });
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path[0]).sort()).toEqual(["branchId", "date", "notes", "serviceId", "time"]);
  });

  it("lets walk-ins omit customer, date and time", () => {
    expect(bookAppointmentInputSchema.safeParse({ branchId: BRANCH, serviceId: SERVICE, type: "walk_in" }).success).toBe(true);
  });
});

describe("status input and transitions", () => {
  it("only accepts target statuses a user can choose", () => {
    expect(changeAppointmentStatusInputSchema.safeParse({ id: BRANCH, status: "booked" }).success).toBe(false);
    expect(changeAppointmentStatusInputSchema.safeParse({ id: "nope", status: "cancelled" }).success).toBe(false);
    expect(changeAppointmentStatusInputSchema.safeParse({ id: BRANCH, status: "no_show" }).success).toBe(true);
  });

  it("only allows forward moves", () => {
    expect(canTransition("booked", "no_show")).toBe(true);
    expect(canTransition("checked_in", "no_show")).toBe(false);
    expect(canTransition("in_service", "cancelled")).toBe(false);
    expect(canTransition("completed", "booked")).toBe(false);
  });
});

describe("board filters", () => {
  it("drops junk and keeps valid values", () => {
    expect(parseAppointmentFilters({ date: "2026-13-40", branchId: "abc", status: "bogus" })).toEqual({ date: undefined, branchId: undefined, status: undefined });
    expect(parseAppointmentFilters({ date: "2026-10-20", branchId: BRANCH, status: "booked" })).toEqual({ date: "2026-10-20", branchId: BRANCH, status: "booked" });
    expect(parseAppointmentFilters({ date: ["2026-10-20", "x"] }).date).toBe("2026-10-20");
  });

  it("round-trips through the URL", () => {
    expect(appointmentsHref({})).toBe("/appointments");
    expect(appointmentsHref({ date: "2026-10-20", status: "booked" })).toBe("/appointments?date=2026-10-20&status=booked");
  });
});
