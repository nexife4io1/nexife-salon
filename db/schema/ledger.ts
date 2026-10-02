import { date, index, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, salon, timestamps } from "./_shared";
import { appointments } from "./operations";
import { branches, tenants } from "./tenancy";

/**
 * Money: payments (split out of the POC's `paid`/`method` booleans into a real
 * ledger) and general finance entries (expenses, other income).
 */

export const paymentMethod = salon.enum("payment_method", ["cash", "card", "upi", "wallet", "other"]);
export const financeEntryType = salon.enum("finance_entry_type", ["income", "expense"]);

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
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethod("method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [index("payments_tenant_paid_idx").on(t.tenantId, t.paidAt), index("payments_branch_paid_idx").on(t.branchId, t.paidAt)],
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
