import { boolean, check, date, index, integer, smallint, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, salon, timestamps } from "./_shared";
import { branches, tenants } from "./tenancy";

/**
 * Day-to-day salon operations: staff, the service catalog, customers and
 * appointments. Field set is derived from the POC's Barber / Service /
 * Customer / Appointment interfaces (see Architecture Vision §5).
 */

export const appointmentStatus = salon.enum("appointment_status", [
  "booked",
  "checked_in",
  "in_service",
  "completed",
  "cancelled",
  "no_show",
]);
export const appointmentType = salon.enum("appointment_type", ["booking", "walk_in"]);
// Who a service is for. Keep in sync with server/shared/audience.ts.
export const serviceAudience = salon.enum("service_audience", ["unisex", "women", "men", "kids"]);

// Keep in sync with server/staff/schema.ts.
export const staffStatus = salon.enum("staff_status", ["active", "on_leave", "inactive"]);
export const staffJobRole = salon.enum("staff_job_role", ["hair_stylist", "beauty_therapist", "salon_assistant", "manager"]);
export const staffGender = salon.enum("staff_gender", ["male", "female", "other", "prefer_not_to_say"]);

// Keep in sync with server/customers/schema.ts.
export const customerGender = salon.enum("customer_gender", ["female", "male", "other", "prefer_not_to_say"]);

export const staff = salon.table(
  "staff",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    title: text("title"),
    // `active` is kept in step with `status` (false only when status = inactive) because
    // branch staff counts and older consumers read it.
    active: boolean("active").notNull().default(true),
    status: staffStatus("status").notNull().default("active"),
    jobRole: staffJobRole("job_role"),
    // Sensitive profile / employment data: only exposed to staff managers (see server/staff/service.ts).
    phone: text("phone"),
    gender: staffGender("gender"),
    address: text("address"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    monthlySalaryCents: integer("monthly_salary_cents"),
    yearsExperience: integer("years_experience"),
    joinedOn: date("joined_on", { mode: "string" }),
    casualLeaves: integer("casual_leaves"),
    recruitmentSource: text("recruitment_source"),
    // 0 = Sunday … 6 = Saturday; null = not set.
    weeklyOffDay: smallint("weekly_off_day"),
    // Secret used with the phone number to mark attendance from a device; unique within a tenant.
    registrationCode: text("registration_code"),
    ...timestamps(),
  },
  (t) => [
    index("staff_tenant_idx").on(t.tenantId),
    uniqueIndex("staff_registration_code_uq").on(t.tenantId, t.registrationCode),
    index("staff_branch_idx").on(t.branchId),
    check("staff_weekly_off_day_chk", sql`${t.weeklyOffDay} between 0 and 6`),
    check("staff_status_active_chk", sql`${t.active} = (${t.status} <> 'inactive')`),
  ],
);

/** One row per staff member per tenant-local day. `workDate` is the tenant's calendar date at check-in. */
export const staffAttendance = salon.table(
  "staff_attendance",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    workDate: date("work_date", { mode: "string" }).notNull(),
    checkInAt: timestamp("check_in_at", { withTimezone: true }).notNull(),
    checkOutAt: timestamp("check_out_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("staff_attendance_staff_day_uq").on(t.staffId, t.workDate),
    index("staff_attendance_tenant_idx").on(t.tenantId),
    check("staff_attendance_order_chk", sql`${t.checkOutAt} is null or ${t.checkOutAt} >= ${t.checkInAt}`),
  ],
);

/** Failed device logins, used to throttle guessing. Deliberately not tenant-scoped: it is read before a tenant is known. */
export const staffLoginAttempts = salon.table(
  "staff_login_attempts",
  {
    id: id(),
    key: text("key").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("staff_login_attempts_key_idx").on(t.key, t.attemptedAt)],
);

/** Services a staff member is qualified to perform. */
export const staffServices = salon.table(
  "staff_services",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("staff_services_staff_service_uq").on(t.staffId, t.serviceId), index("staff_services_tenant_idx").on(t.tenantId)],
);

/** One shift per working weekday. A weekday with no row is a day off / not scheduled. */
export const staffWorkingHours = salon.table(
  "staff_working_hours",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    startTime: time("start_time", { precision: 0 }).notNull(),
    endTime: time("end_time", { precision: 0 }).notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("staff_working_hours_staff_day_uq").on(t.staffId, t.dayOfWeek),
    index("staff_working_hours_tenant_idx").on(t.tenantId),
    check("staff_working_hours_day_chk", sql`${t.dayOfWeek} between 0 and 6`),
    check("staff_working_hours_order_chk", sql`${t.endTime} > ${t.startTime}`),
  ],
);

/** Daily breaks (e.g. lunch) that apply on every working day. */
export const staffBreaks = salon.table(
  "staff_breaks",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    label: text("label"),
    startTime: time("start_time", { precision: 0 }).notNull(),
    endTime: time("end_time", { precision: 0 }).notNull(),
    ...timestamps(),
  },
  (t) => [index("staff_breaks_staff_idx").on(t.staffId), index("staff_breaks_tenant_idx").on(t.tenantId), check("staff_breaks_order_chk", sql`${t.endTime} > ${t.startTime}`)],
);

/**
 * Platform-level service catalog managed by Nexife super admins. Deliberately has
 * no tenant_id and no RLS: tenants copy a template into their own `services` rows.
 */
export const serviceTemplates = salon.table("service_templates", {
  id: id(),
  name: text("name").notNull(),
  category: text("category"),
  audience: serviceAudience("audience").notNull().default("unisex"),
  defaultDurationMinutes: integer("default_duration_minutes").notNull().default(30),
  defaultPriceCents: integer("default_price_cents").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps(),
});

export const services = salon.table(
  "services",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Set when the service was copied from a platform template; null for tenant-made services.
    templateId: uuid("template_id").references(() => serviceTemplates.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    category: text("category"),
    audience: serviceAudience("audience").notNull().default("unisex"),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    // Money is stored in minor units (cents) everywhere.
    priceCents: integer("price_cents").notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("services_tenant_idx").on(t.tenantId), uniqueIndex("services_tenant_template_uq").on(t.tenantId, t.templateId)],
);

/** Which of the tenant's services each branch offers. */
export const branchServices = salon.table(
  "branch_services",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("branch_services_branch_service_uq").on(t.branchId, t.serviceId), index("branch_services_tenant_idx").on(t.tenantId)],
);

export const customers = salon.table(
  "customers",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    visitCount: integer("visit_count").notNull().default(0),
    // Customer profile fields. Keep in sync with server/customers/schema.ts. All nullable: older rows have none.
    birthday: date("birthday", { mode: "string" }),
    gender: customerGender("gender"),
    notes: text("notes"),
    // Digits-only form of `phone`, used for de-duplication. NULL when there is no phone.
    phoneKey: text("phone_key"),
    ...timestamps(),
  },
  (t) => [
    index("customers_tenant_idx").on(t.tenantId),
    // One customer per phone per tenant; also the backstop for concurrent creates.
    uniqueIndex("customers_tenant_phone_key_uq").on(t.tenantId, t.phoneKey).where(sql`${t.phoneKey} is not null`),
  ],
);

export const appointments = salon.table(
  "appointments",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    type: appointmentType("type").notNull().default("booking"),
    status: appointmentStatus("status").notNull().default("booked"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    index("appointments_tenant_starts_idx").on(t.tenantId, t.startsAt),
    index("appointments_branch_starts_idx").on(t.branchId, t.startsAt),
  ],
);

/**
 * The services booked on an appointment, as a snapshot: name, price and duration are copied from the catalog
 * at booking time so later catalog edits never rewrite history. `appointments.service_id` still points at the
 * first line for older consumers.
 */
export const appointmentServices = salon.table(
  "appointment_services",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    position: smallint("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("appointment_services_appointment_idx").on(t.appointmentId),
    index("appointment_services_tenant_idx").on(t.tenantId),
    check("appointment_services_price_chk", sql`${t.priceCents} >= 0`),
    check("appointment_services_duration_chk", sql`${t.durationMinutes} > 0`),
  ],
);
