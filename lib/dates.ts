/**
 * [start, end) of the calendar day containing `at`, in UTC.
 * TODO(step 1): use the tenant's timezone (tenants.timezone) once tenants are DB-backed.
 */
export function utcDayRange(at = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// --- Tenant-timezone helpers ---------------------------------------------------------------------
// Instants are always stored/passed as UTC `Date`s; a tenant's wall-clock date/time only exists at the edges.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Falls back to UTC for a zone Intl does not know, so a bad tenant row never breaks a page. */
function safeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

function wallClock(at: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of `at` on the wall clock of `timeZone`. */
export function zonedDateString(at: Date, timeZone: string): string {
  const w = wallClock(at, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** "HH:MM" (24h) of `at` on the wall clock of `timeZone`. */
export function zonedTimeString(at: Date, timeZone: string): string {
  const w = wallClock(at, timeZone);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

export function isValidDateString(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

export function isValidTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

/** Calendar arithmetic on a "YYYY-MM-DD" string (no timezone involved). */
export function addDaysToDateString(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The UTC instant at which the wall clock in `timeZone` reads `date` `time`.
 * Returns null when that wall-clock time does not exist (the hour skipped by a DST jump) or the input is malformed.
 * For a repeated hour (DST fall-back) the earlier instant wins.
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date | null {
  if (!isValidDateString(date) || !isValidTimeString(time)) return null;
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi);

  const offsetAt = (instant: number) => {
    const w = wallClock(new Date(instant), timeZone);
    return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) - instant;
  };
  // Two passes settle the offset across a DST boundary.
  let utc = asIfUtc - offsetAt(asIfUtc);
  utc = asIfUtc - offsetAt(utc);

  const back = wallClock(new Date(utc), timeZone);
  const roundTrips = back.year === y && back.month === mo && back.day === d && back.hour === h && back.minute === mi;
  return roundTrips ? new Date(utc) : null;
}

/** [start, end) of the calendar day `date` ("YYYY-MM-DD") in `timeZone`; DST days are 23 or 25 hours long. */
export function zonedDayRange(date: string, timeZone: string): { start: Date; end: Date } {
  const edge = (day: string) => {
    for (const time of ["00:00", "01:00", "02:00"]) {
      const at = zonedTimeToUtc(day, time, timeZone); // some zones skip midnight on DST days
      if (at) return at;
    }
    return new Date(`${day}T00:00:00Z`);
  };
  return { start: edge(date), end: edge(addDaysToDateString(date, 1)) };
}
