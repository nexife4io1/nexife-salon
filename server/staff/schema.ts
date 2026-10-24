import { z } from "zod";
import { parseMoneyToCents } from "@/lib/format";

// --- Vocabulary (keep in sync with the enums in db/schema/operations.ts) ---------------------------

export const STAFF_STATUSES = ["active", "on_leave", "inactive"] as const;
export const staffStatusSchema = z.enum(STAFF_STATUSES);
export type StaffStatus = z.infer<typeof staffStatusSchema>;
export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = { active: "Active", on_leave: "On leave", inactive: "Inactive" };

export const STAFF_JOB_ROLES = ["hair_stylist", "beauty_therapist", "salon_assistant", "manager"] as const;
export const staffJobRoleSchema = z.enum(STAFF_JOB_ROLES);
export type StaffJobRole = z.infer<typeof staffJobRoleSchema>;
export const STAFF_JOB_ROLE_LABELS: Record<StaffJobRole, string> = {
  hair_stylist: "Hair Stylist",
  beauty_therapist: "Beauty Therapist",
  salon_assistant: "Salon Assistant",
  manager: "Manager",
};

export const STAFF_GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
export const staffGenderSchema = z.enum(STAFF_GENDERS);
export type StaffGender = z.infer<typeof staffGenderSchema>;
export const STAFF_GENDER_LABELS: Record<StaffGender, string> = { male: "Male", female: "Female", other: "Other", prefer_not_to_say: "Prefer not to say" };

/** Index = `day_of_week` in the database (0 = Sunday). */
export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export const weekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof weekdaySchema>;
export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const MAX_BREAKS = 4;
export const MAX_STAFF_SERVICES = 200;

// --- Read models -----------------------------------------------------------------------------------

/** Original, minimal staff shape. Kept stable for existing consumers. */
export const staffMemberSchema = z.object({
  id: z.string(),
  branchId: z.string().nullable(),
  name: z.string(),
  initials: z.string(),
  title: z.string().nullable(),
  active: z.boolean(),
});
export type StaffMember = z.infer<typeof staffMemberSchema>;

/** "HH:MM", 24h. */
export type ClockTime = string;
export type WorkingHours = { day: number; start: ClockTime; end: ClockTime };
export type StaffBreak = { label: string | null; start: ClockTime; end: ClockTime };
export type StaffSchedule = { weeklyOffDay: number | null; hours: WorkingHours[]; breaks: StaffBreak[] };

export type AvailabilityState = "available" | "on_break" | "off_shift" | "day_off" | "on_leave" | "inactive" | "unscheduled";
/** Derived from persisted status + schedule at read time; never stored. */
export type Availability = { state: AvailabilityState; label: string };

/** One directory row. Deliberately excludes sensitive profile/employment fields. */
export type StaffListItem = StaffMember & {
  status: StaffStatus;
  jobRole: StaffJobRole | null;
  branchName: string | null;
  availability: Availability;
};

/** Full profile, only ever returned to staff managers. */
export type StaffProfile = StaffListItem & {
  phone: string | null;
  gender: StaffGender | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  monthlySalaryCents: number | null;
  yearsExperience: number | null;
  joinedOn: string | null;
  casualLeaves: number | null;
  recruitmentSource: string | null;
  schedule: StaffSchedule;
  /** Secret for the mobile attendance page. Managers only, same as the rest of the profile. */
  registrationCode: string | null;
  /** Services this person performs (empty = no restriction: they can take any service their branch offers). */
  serviceIds: string[];
};

export type StaffBranchOption = { id: string; name: string; status: "active" | "inactive" | "opening_soon" };

/** A catalog service the staff form can assign. */
export type StaffServiceOption = { id: string; name: string; category: string | null; durationMinutes: number; priceCents: number };

/** Options the add/edit form needs. */
export type StaffFormOptions = {
  branches: StaffBranchOption[];
  /** Active catalog services; a staff member may only be given ones their branch offers. */
  services: StaffServiceOption[];
  /** Service ids each branch offers. */
  offeredByBranch: Record<string, string[]>;
  currency: string;
  source: "database" | "demo";
};

// --- Directory filters -----------------------------------------------------------------------------

export const staffFiltersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  branchId: z.string().uuid().optional(),
  status: staffStatusSchema.optional(),
});
export type StaffFilters = z.infer<typeof staffFiltersSchema>;

/** Lenient parse of URL search params: anything invalid is dropped instead of erroring. */
export function parseStaffFilters(raw: Record<string, string | string[] | undefined>): StaffFilters {
  const pick = (key: string) => {
    const v = raw[key];
    const s = Array.isArray(v) ? v[0] : v;
    return s === undefined || s.trim() === "" ? undefined : s;
  };
  const parsed = staffFiltersSchema.safeParse({ q: pick("q"), branchId: pick("branchId"), status: pick("status") });
  if (parsed.success) return parsed.data;
  const lenient = {
    q: staffFiltersSchema.shape.q.safeParse(pick("q")).data,
    branchId: staffFiltersSchema.shape.branchId.safeParse(pick("branchId")).data,
    status: staffFiltersSchema.shape.status.safeParse(pick("status")).data,
  };
  return lenient;
}

// --- Write input -----------------------------------------------------------------------------------

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
const optionalEnum = <T extends z.ZodType>(schema: T) => z.preprocess(blankToUndefined, schema.optional());

const optionalPhone = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .regex(/^\+?[\d][\d\s().-]{5,19}$/, "Enter a valid phone number")
    .optional(),
);

const optionalInt = (label: string, max: number) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .regex(/^\d+$/, `${label} must be a whole number`)
      .transform(Number)
      .pipe(z.number().int().min(0).max(max, `${label} is too large`))
      .optional(),
  );

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");
const optionalClockTime = z.preprocess(blankToUndefined, clockTime.optional());

const optionalDate = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "Enter a valid date")
    .optional(),
);

const monthlySalary = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .max(20)
    .refine((v) => parseMoneyToCents(v) !== null, "Enter an amount like 45000 or 45000.50")
    .transform((v) => parseMoneyToCents(v)!)
    .pipe(z.number().int().max(2_000_000_000, "Amount is too large"))
    .optional(),
);

export const staffBreakInputSchema = z.object({
  label: optionalText(40),
  start: clockTime,
  end: clockTime,
});

export const staffInputSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the staff member's name").max(80),
    title: optionalText(60),
    phone: optionalPhone,
    gender: optionalEnum(staffGenderSchema),
    address: optionalText(200),
    emergencyContactName: optionalText(80),
    emergencyContactPhone: optionalPhone,

    branchId: z.string().uuid("Choose a branch"),
    jobRole: optionalEnum(staffJobRoleSchema),
    status: staffStatusSchema.default("active"),
    monthlySalaryCents: monthlySalary,
    yearsExperience: optionalInt("Years of experience", 70),
    joinedOn: optionalDate,
    casualLeaves: optionalInt("Casual leaves", 365),
    recruitmentSource: optionalText(120),

    weeklyOff: optionalEnum(weekdaySchema),
    shiftStart: optionalClockTime,
    shiftEnd: optionalClockTime,
    breaks: z.array(staffBreakInputSchema).max(MAX_BREAKS, `At most ${MAX_BREAKS} breaks`).default([]),

    serviceIds: z
      .array(z.string().uuid("Choose a valid service"))
      .max(MAX_STAFF_SERVICES, `At most ${MAX_STAFF_SERVICES} services`)
      .refine((ids) => new Set(ids).size === ids.length, "Each service can only be added once")
      .default([]),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });

    if ((v.shiftStart && !v.shiftEnd) || (!v.shiftStart && v.shiftEnd)) {
      issue([v.shiftStart ? "shiftEnd" : "shiftStart"], "Set both check-in and check-out times");
      return;
    }
    if (v.shiftStart && v.shiftEnd && v.shiftEnd <= v.shiftStart) issue(["shiftEnd"], "Check-out must be after check-in");

    if (v.breaks.length && !v.shiftStart) {
      issue(["breaks"], "Set check-in and check-out times before adding breaks");
      return;
    }
    const sorted = v.breaks.map((b, index) => ({ ...b, index })).sort((a, b) => a.start.localeCompare(b.start));
    sorted.forEach((b, i) => {
      if (b.end <= b.start) return issue(["breaks", b.index, "end"], "Break must end after it starts");
      if (v.shiftStart && v.shiftEnd && (b.start < v.shiftStart || b.end > v.shiftEnd)) {
        return issue(["breaks", b.index, "start"], "Break must fall within the shift");
      }
      const prev = sorted[i - 1];
      if (prev && prev.end > b.start) issue(["breaks", b.index, "start"], "Breaks must not overlap");
    });
  });
/** Parsed (output) shape — what services and repositories receive. */
export type StaffInput = z.output<typeof staffInputSchema>;
/** Kept for the original export name. */
export const createStaffInputSchema = staffInputSchema;
export type CreateStaffInput = StaffInput;

export const setStaffStatusInputSchema = z.object({ id: z.string().uuid(), status: staffStatusSchema });
export const registrationCodeInputSchema = z.object({ id: z.string().uuid() });

export type SetStaffStatusInput = z.infer<typeof setStaffStatusInputSchema>;

// --- Normalised write model (service → repository) -------------------------------------------------

export type StaffWrite = {
  name: string;
  initials: string;
  title: string | null;
  branchId: string;
  jobRole: StaffJobRole | null;
  status: StaffStatus;
  phone: string | null;
  gender: StaffGender | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  monthlySalaryCents: number | null;
  yearsExperience: number | null;
  joinedOn: string | null;
  casualLeaves: number | null;
  recruitmentSource: string | null;
  weeklyOffDay: number | null;
  hours: WorkingHours[];
  breaks: StaffBreak[];
  serviceIds: string[];
};

// --- Form / URL helpers (pure, shared with the client form and filter bar) -------------------------

/** Submitted values keyed by field name, so a failed submit can repopulate the form. */
export type StaffFormValues = Record<string, string[]>;

export function staffFormValues(formData: FormData): StaffFormValues {
  const values: StaffFormValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") (values[key] ??= []).push(value);
  }
  return values;
}

/** Directory URL for a set of filters; blank values are dropped so "no filters" is plain `/staff`. */
export function staffFiltersHref(filters: { q?: string; branchId?: string; status?: string }): string {
  const params = new URLSearchParams();
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return qs ? `/staff?${qs}` : "/staff";
}
