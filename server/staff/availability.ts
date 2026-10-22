import type { Availability, StaffSchedule, StaffStatus } from "./schema";

/**
 * Availability is derived at read time from persisted employment status + schedule.
 * Dated leave is managed separately by the attendance domain.
 */

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Local weekday (0 = Sunday) and minutes since midnight for `at` in `timeZone` (falls back to UTC). */
export function localDayAndMinutes(at: Date, timeZone: string): { day: number; minutes: number } {
  const parts = (zone: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  let p: Intl.DateTimeFormatPart[];
  try {
    p = parts(timeZone);
  } catch {
    p = parts("UTC");
  }
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "0";
  return { day: WEEKDAY_INDEX[get("weekday")] ?? 0, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function computeAvailability(member: { status: StaffStatus; schedule: StaffSchedule }, at: Date, timeZone: string): Availability {
  if (member.status === "inactive") return { state: "inactive", label: "Inactive" };
  const { weeklyOffDay, hours, breaks } = member.schedule;
  const { day, minutes } = localDayAndMinutes(at, timeZone);

  if (weeklyOffDay === day) return { state: "day_off", label: "Weekly off today" };
  if (!hours.length) return { state: "unscheduled", label: "Schedule not set" };

  const today = hours.filter((h) => h.day === day).sort((a, b) => a.start.localeCompare(b.start));
  if (!today.length) return { state: "day_off", label: "Not scheduled today" };

  const currentShift = today.find((shift) => minutes >= toMinutes(shift.start) && minutes < toMinutes(shift.end));
  if (!currentShift) {
    const next = today.find((shift) => minutes < toMinutes(shift.start));
    return next
      ? { state: "off_shift", label: `Starts at ${next.start}` }
      : { state: "off_shift", label: `Finished at ${today[today.length - 1]!.end}` };
  }

  const currentBreak = breaks.find((b) => minutes >= toMinutes(b.start) && minutes < toMinutes(b.end));
  if (currentBreak) return { state: "on_break", label: `On break until ${currentBreak.end}` };
  return { state: "available", label: `Available until ${currentShift.end}` };
}
