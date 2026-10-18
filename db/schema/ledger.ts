import { check, date, index, integer, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, salon, timestamps } from "./_shared";
import { appointments, customers, services } from "./operations";
import { branches, tenants } from "./tenancy";

/**
 * Money: payments (split out of the POC's `paid`/`method` booleans into a real
 * ledger) and general finance entries (expenses, other income).
 */

export const paymentMethod = salon.enum("payment_method", ["cash", "card", "upi", "wallet", "other"]);
export const financeEntryType = salon.enum("finance_entry_type", ["income", "expense"]);

/**
 * A bill that has been paid in full. Invoices are only written at the moment payment is recorded (inside one
 * transaction with their lines and payments), so an appointment is "unpaid" until its invoice exists and
 * "paid" from then on. The receipt is this row: `receipt_number` is its stable public reference.
 */
export const invoices = salon.table(
  "invoices",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    // At most one invoice per appointment: the unique index is what makes a double submit harmless.
    appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    // Snapshots, so the receipt survives customer renames and deletions.
    customerName: text("customer_name"),
    receiptNumber: text("receipt_number").notNull(),
    currency: text("currency").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("invoices_tenant_appointment_uq").on(t.tenantId, t.appointmentId).where(sql`${t.appointmentId} is not null`),
    uniqueIndex("invoices_tenant_receipt_uq").on(t.tenantId, t.receiptNumber),
    index("invoices_tenant_paid_idx").on(t.tenantId, t.paidAt),
    index("invoices_customer_idx").on(t.customerId),
    check("invoices_total_chk", sql`${t.totalCents} > 0 and ${t.totalCents} = ${t.subtotalCents}`),
  ],
);

export const invoiceLineKind = salon.enum("invoice_line_kind", ["catalog", "custom"]);

/** One billed item. Name and price are snapshots; `service_id` is only a pointer for reporting. */
export const invoiceLines = salon.table(
  "invoice_lines",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    kind: invoiceLineKind("kind").notNull().default("catalog"),
    name: text("name").notNull(),
    staffName: text("staff_name"),
    amountCents: integer("amount_cents").notNull(),
    position: smallint("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("invoice_lines_invoice_idx").on(t.invoiceId),
    index("invoice_lines_tenant_idx").on(t.tenantId),
    check("invoice_lines_amount_chk", sql`${t.amountCents} >= 0`),
  ],
);

/** Per-tenant receipt counter; incremented with an atomic upsert so numbers never repeat. */
export const invoiceCounters = salon.table("invoice_counters", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  lastNumber: integer("last_number").notNull().default(0),
});

export const payments = salon.table(
  "payments",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    // The bill this payment settles. A split payment is several rows sharing one invoice.
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethod("method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [
    index("payments_tenant_paid_idx").on(t.tenantId, t.paidAt),
    index("payments_branch_paid_idx").on(t.branchId, t.paidAt),
    index("payments_invoice_idx").on(t.invoiceId),
  ],
);

export const financeEntries = salon.table(
  "finance_entries",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    type: financeEntryType("type").notNull(),
    category: text("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
    occurredOn: date("occurred_on").notNull(),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [index("finance_entries_tenant_date_idx").on(t.tenantId, t.occurredOn)],
);
