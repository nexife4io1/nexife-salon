import { boolean, index, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
    active: boolean("active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("staff_tenant_idx").on(t.tenantId), index("staff_branch_idx").on(t.branchId)],
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
    ...timestamps(),
  },
  (t) => [index("customers_tenant_idx").on(t.tenantId)],
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
