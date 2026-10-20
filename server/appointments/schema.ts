import { z } from "zod";
import { isValidDateString, isValidTimeString } from "@/lib/dates";

export const APPOINTMENT_STATUSES = ["booked", "checked_in", "in_service", "completed", "cancelled", "no_show"] as const;
export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Booked",
  checked_in: "Checked in",
  in_service: "In service",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const APPOINTMENT_TYPES = ["booking", "walk_in"] as const;
export const appointmentTypeSchema = z.enum(APPOINTMENT_TYPES);
export type AppointmentType = z.infer<typeof appointmentTypeSchema>;
export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = { booking: "Booking", walk_in: "Walk-in" };

/** Duration used for an appointment whose service has since been removed. */
export const FALLBACK_DURATION_MINUTES = 30;

/** Statuses that still hold the staff member's time (cancelled / no-show free the slot). */
export const SLOT_HOLDING_STATUSES = ["booked", "checked_in", "in_service", "completed"] as const satisfies readonly AppointmentStatus[];

/** Statuses of an appointment that still has work to do: what the board shows by default. */
export const UPCOMING_STATUSES = ["booked", "checked_in", "in_service"] as const satisfies readonly AppointmentStatus[];

/** Legal status moves. Terminal states (completed, cancelled, no_show) have none. */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  booked: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_service", "cancelled"],
  in_service: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Only a booking that hasn't been checked in can be edited or rescheduled; walk-ins never can. */
export function canEditAppointment(a: { type: AppointmentType; status: AppointmentStatus }): boolean {
  return a.type === "booking" && a.status === "booked";
}

/** No-show means the client didn't turn up, so it only makes sense once the scheduled start has passed. */
export function canMarkNoShow(a: { type: AppointmentType; status: AppointmentStatus; startsAt: Date }, now: Date): boolean {
  return a.type === "booking" && canTransition(a.status, "no_show") && a.startsAt.getTime() <= now.getTime();
}

/** One booked service, as snapshotted when the appointment was made (name, price and duration never change later). */
export const appointmentServiceLineSchema = z.object({
  id: z.string(),
  serviceId: z.string().nullable(),
  name: z.string(),
  priceCents: z.number().int(),
  durationMinutes: z.number().int(),
});
export type AppointmentServiceLine = z.infer<typeof appointmentServiceLineSchema>;

/** Most services one appointment (and one bill) can carry. */
export const MAX_SERVICES_PER_APPOINTMENT = 10;

export const appointmentSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  customerId: z.string().nullable(),
  /** The first booked service (kept for older consumers); `services` is the full list. */
  serviceId: z.string().nullable(),
  staffId: z.string().nullable(),
  customerName: z.string().nullable(),
  /** Every booked service name, comma separated; null when none are left. */
  serviceName: z.string().nullable(),
  staffName: z.string().nullable(),
  services: z.array(appointmentServiceLineSchema),
  /** Sum of the service prices, in minor units. */
  totalCents: z.number().int(),
  startsAt: z.date(),
  /** startsAt plus the total service duration (appointments store no end time of their own). */
  endsAt: z.date(),
  durationMinutes: z.number().int(),
  type: appointmentTypeSchema,
  status: appointmentStatusSchema,
  notes: z.string().nullable(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

// --- Booking input ----------------------------------------------------------------------------------

/** HTML forms send "" for an untouched field. */
const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const optionalUuid = z.preprocess(blankToUndefined, z.string().uuid("Choose a valid option").optional());

/** A form posts one `serviceId` per selected service; a single string is accepted too. Blanks are dropped. */
const toIdList = (value: unknown): unknown => {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return list.filter((item) => !(typeof item === "string" && item.trim() === ""));
};
const uuidPattern = z.string().uuid();
const serviceIdList = z.preprocess(
  toIdList,
  z
    .array(z.string(), { error: "Choose a service" })
    .min(1, "Choose a service")
    .max(MAX_SERVICES_PER_APPOINTMENT, `Choose at most ${MAX_SERVICES_PER_APPOINTMENT} services`)
    .refine((ids) => ids.every((id) => uuidPattern.safeParse(id).success), "Choose a service")
    .refine((ids) => new Set(ids).size === ids.length, "Each service can only be added once"),
);

/**
 * `date` ("YYYY-MM-DD") and `time` ("HH:MM") are wall-clock values in the tenant's timezone; the service turns
 * them into an instant. Walk-ins start "now" on the server, so they send neither.
 */
export const bookAppointmentInputSchema = z
  .object({
    branchId: z.string({ error: "Choose a branch" }).uuid("Choose a branch"),
    customerId: optionalUuid,
    serviceId: serviceIdList,
    staffId: optionalUuid,
    date: z.preprocess(blankToUndefined, z.string().refine(isValidDateString, "Enter a valid date").optional()),
    time: z.preprocess(blankToUndefined, z.string().refine(isValidTimeString, "Enter a valid time").optional()),
    type: z.preprocess(blankToUndefined, appointmentTypeSchema.default("booking")),
    notes: z.preprocess(blankToUndefined, z.string().trim().max(500, "Keep notes under 500 characters").optional()),
  })
  .superRefine((value, ctx) => {
    if (value.type === "booking") {
      if (!value.customerId) ctx.addIssue({ code: "custom", path: ["customerId"], message: "Choose a customer, or switch to walk-in" });
      if (!value.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Choose a date" });
      if (!value.time) ctx.addIssue({ code: "custom", path: ["time"], message: "Choose a time" });
    }
  });
export type BookAppointmentInput = z.output<typeof bookAppointmentInputSchema>;

export const changeAppointmentStatusInputSchema = z.object({
  id: z.string().uuid("Appointment not found"),
  status: z.enum(["checked_in", "in_service", "completed", "cancelled", "no_show"]),
});
export type ChangeAppointmentStatusInput = z.infer<typeof changeAppointmentStatusInputSchema>;

export const deleteAppointmentInputSchema = z.object({ id: z.string().uuid("Appointment not found") });
export type DeleteAppointmentInput = z.infer<typeof deleteAppointmentInputSchema>;

/** An existing booking, in the shape the edit form needs (date/time are tenant-local wall-clock values). */
export type EditableAppointment = {
  id: string;
  branchId: string;
  customerId: string | null;
  serviceIds: string[];
  staffId: string | null;
  date: string;
  time: string;
  notes: string | null;
};

// --- Board filters (live in the URL) -----------------------------------------------------------------

/** "upcoming" (the default) = booked, checked in or in service; "all" = every status. */
export type AppointmentStatusFilter = AppointmentStatus | "upcoming" | "all";

export type AppointmentFilters = {
  /** "YYYY-MM-DD" in the tenant timezone; undefined = today. */
  date?: string;
  branchId?: string;
  /** undefined = "upcoming". */
  status?: AppointmentStatusFilter;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Tolerant: junk in the URL is dropped rather than raising. */
export function parseAppointmentFilters(raw: Record<string, string | string[] | undefined>): AppointmentFilters {
  const date = first(raw.date);
  const branchId = first(raw.branchId);
  const rawStatus = first(raw.status);
  const status = appointmentStatusSchema.safeParse(rawStatus);
  return {
    date: date && isValidDateString(date) ? date : undefined,
    branchId: branchId && z.string().uuid().safeParse(branchId).success ? branchId : undefined,
    status: status.success ? status.data : rawStatus === "all" ? "all" : undefined,
  };
}

export function appointmentsHref(filters: AppointmentFilters): string {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  return query ? `/appointments?${query}` : "/appointments";
}

// --- View models --------------------------------------------------------------------------------------

export type AppointmentBoard = {
  /** The displayed day, "YYYY-MM-DD" in `timezone`. */
  date: string;
  today: string;
  /** The instant the board was built, so "has it started yet" is decided on the server. */
  now: Date;
  timezone: string;
  filters: AppointmentFilters;
  appointments: Appointment[];
  /** Active staff for the column headers (appointments may reference staff not listed here). */
  staff: { id: string; name: string; title: string | null; branchId: string | null }[];
  branches: { id: string; name: string }[];
  /** Counts for the whole day under the branch filter, before the status filter, so the chips stay stable. */
  counts: Record<AppointmentStatus, number>;
  source: "database" | "demo";
};

export type BookingOptions = {
  timezone: string;
  currency: string;
  /** Tenant-local "now", used to prefill and bound the date/time inputs. */
  today: string;
  nowTime: string;
  branches: { id: string; name: string; status: "active" | "inactive" | "opening_soon" }[];
  services: { id: string; name: string; category: string | null; durationMinutes: number; priceCents: number }[];
  /** Service ids each branch offers. */
  offeredByBranch: Record<string, string[]>;
  staff: { id: string; name: string; title: string | null; branchId: string | null }[];
  /** Service ids each staff member performs. Staff absent from the map have declared none and can take any service. */
  staffServices: Record<string, string[]>;
  customers: { id: string; name: string; phone: string | null }[];
  source: "database" | "demo";
};

export type BookingFormValues = Record<string, string>;

export function bookingFormValues(formData: FormData): BookingFormValues {
  const values: BookingFormValues = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;
  return values;
}
