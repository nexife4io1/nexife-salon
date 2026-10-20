import { z } from "zod";

// --- Read models -----------------------------------------------------------------------------------

export const CUSTOMER_GENDERS = ["female", "male", "other", "prefer_not_to_say"] as const;
export const customerGenderSchema = z.enum(CUSTOMER_GENDERS);
export type CustomerGender = z.infer<typeof customerGenderSchema>;
export const CUSTOMER_GENDER_LABELS: Record<CustomerGender, string> = {
  female: "Female",
  male: "Male",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

export const MAX_NOTES_LENGTH = 1000;

/** Minimal customer reference (also what the booking form picks from). */
export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  visitCount: z.number().int(),
});
export type Customer = z.infer<typeof customerSchema>;

export type CustomerListItem = Customer & { createdAt: string };

/** Full profile: everything stored about one customer. */
export type CustomerProfile = CustomerListItem & {
  birthday: string | null;
  gender: CustomerGender | null;
  notes: string | null;
};

export type CustomerStats = {
  total: number;
  /** Customers created since the start of the current UTC month. */
  newThisMonth: number;
  /** Customers with two or more recorded visits. */
  returning: number;
};

export type CustomerDirectory = {
  customers: CustomerListItem[];
  stats: CustomerStats;
  /** Customers matching the filters (across all pages). */
  matching: number;
  page: number;
  pageCount: number;
  pageSize: number;
  /** "demo" = no database configured: the list is empty and read-only. */
  source: "database" | "demo";
  filtered: boolean;
};

// --- Phone normalization ---------------------------------------------------------------------------

export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 15; // E.164

export type NormalizedPhone = {
  /** What we store and show: optional leading "+", then digits only. */
  phone: string;
  /** Digits only. Two customers in one tenant cannot share a key. */
  key: string;
};

/** Returns null when `raw` is not a plausible phone number. Separators ( ) - . and spaces are ignored. */
export function normalizePhone(raw: string): NormalizedPhone | null {
  const trimmed = raw.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const key = trimmed.replace(/\D/g, "");
  if (key.length < PHONE_MIN_DIGITS || key.length > PHONE_MAX_DIGITS) return null;
  return { phone: `${trimmed.startsWith("+") ? "+" : ""}${key}`, key };
}

// --- Directory filters -----------------------------------------------------------------------------

export const CUSTOMER_SORTS = ["recent", "name", "visits"] as const;
export const customerSortSchema = z.enum(CUSTOMER_SORTS);
export type CustomerSort = z.infer<typeof customerSortSchema>;
export const CUSTOMER_SORT_LABELS: Record<CustomerSort, string> = {
  recent: "Recently added",
  name: "Name (A–Z)",
  visits: "Most visits",
};

export const CUSTOMERS_PAGE_SIZE = 20;

export const customerSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  sort: customerSortSchema.default("name"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CustomerSearch = z.infer<typeof customerSearchSchema>;

/** What the directory URL carries. `limit` is fixed to the page size for the UI. */
export type CustomerFilters = { q?: string; sort: CustomerSort; page: number };

/** Lenient parse of URL search params: anything invalid is dropped instead of erroring. */
export function parseCustomerFilters(raw: Record<string, string | string[] | undefined>): CustomerFilters {
  const pick = (key: string) => {
    const v = raw[key];
    const s = Array.isArray(v) ? v[0] : v;
    return s === undefined || s.trim() === "" ? undefined : s;
  };
  return {
    q: customerSearchSchema.shape.q.safeParse(pick("q")).data,
    sort: customerSortSchema.catch("recent").parse(pick("sort")),
    page: customerSearchSchema.shape.page.catch(1).parse(pick("page")),
  };
}

/** Directory URL for a set of filters; defaults are dropped so "no filters" is plain `/customers`. */
export function customersHref(filters: { q?: string; sort?: string; page?: number }): string {
  const params = new URLSearchParams();
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  if (filters.sort && filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const qs = params.toString();
  return qs ? `/customers?${qs}` : "/customers";
}

// --- Write input -----------------------------------------------------------------------------------

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const isRealDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

export const customerInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer's name").max(80, "Name is too long"),
  phone: z
    .string({ error: "Enter a contact number" })
    .trim()
    .min(1, "Enter a contact number")
    .max(32, "Phone number is too long")
    .transform((value, ctx) => {
      const normalized = normalizePhone(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: `Enter a valid phone number (${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits)` });
        return z.NEVER;
      }
      return normalized;
    }),
  email: z.preprocess(blankToUndefined, z.string().trim().toLowerCase().max(120).email("Enter a valid email address").optional()),
  birthday: z.preprocess(
    blankToUndefined,
    z
      .string()
      .refine(isRealDate, "Enter a valid date")
      .refine((v) => v >= "1900-01-01", "Enter a valid date")
      .refine((v) => v <= new Date().toISOString().slice(0, 10), "Birthday can't be in the future")
      .optional(),
  ),
  gender: z.preprocess(blankToUndefined, customerGenderSchema.optional()),
  notes: z.preprocess(blankToUndefined, z.string().trim().max(MAX_NOTES_LENGTH, `Notes can be up to ${MAX_NOTES_LENGTH} characters`).optional()),
});
export type CustomerInput = z.infer<typeof customerInputSchema>;

export const customerIdSchema = z.string().uuid();

/** Raw submitted strings per field, so a failed submit can repopulate the form. */
export type CustomerFormValues = Record<string, string[]>;

export function customerFormValues(formData: FormData): CustomerFormValues {
  const values: CustomerFormValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") (values[key] ??= []).push(value);
  }
  return values;
}
