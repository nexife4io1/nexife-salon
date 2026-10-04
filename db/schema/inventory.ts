import { index, integer, text, uuid } from "drizzle-orm/pg-core";
import { id, salon, timestamps } from "./_shared";
import { branches, tenants } from "./tenancy";

/**
 * Inventory: items and an append-only stock movement log. On-hand quantity is
 * derived from movements (sum of `quantity_delta`) rather than mutated in place.
 */

export const stockMovementReason = salon.enum("stock_movement_reason", [
  "purchase",
  "sale",
  "service_use",
  "adjustment",
  "transfer",
]);

export const inventoryItems = salon.table(
  "inventory_items",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    sku: text("sku"),
    name: text("name").notNull(),
    unit: text("unit").notNull().default("pcs"),
    reorderLevel: integer("reorder_level").notNull().default(0),
    costCents: integer("cost_cents"),
    ...timestamps(),
  },
  (t) => [index("inventory_items_tenant_idx").on(t.tenantId)],
);

export const stockMovements = salon.table(
  "stock_movements",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    quantityDelta: integer("quantity_delta").notNull(),
    reason: stockMovementReason("reason").notNull(),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [index("stock_movements_item_idx").on(t.itemId)],
);
