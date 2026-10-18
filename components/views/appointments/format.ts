/** Clock time such as "9:30 AM" on the tenant's wall clock (never the viewer's or the server's). */
export function formatClock(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(at);
  }
}

/** "Fri, Oct 16, 2026" for a "YYYY-MM-DD" calendar date (no timezone shifts). */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
