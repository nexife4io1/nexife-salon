/** Presentation formatters shared by server and UI. Money is always in minor units (cents). */

export function formatMoney(cents: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Parse a user-typed decimal price ("95", "95.5", "$1,250.00") into cents; null if invalid or negative. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[\s,$]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Cents to an editable decimal string for price inputs ("9500" becomes "95.00"). */
export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Stable, timezone-independent date label (safe to render on server and client). */
export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
