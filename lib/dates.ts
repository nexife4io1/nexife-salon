/**
 * [start, end) of the calendar day containing `at`, in UTC.
 * TODO(step 1): use the tenant's timezone (tenants.timezone) once tenants are DB-backed.
 */
export function utcDayRange(at = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
