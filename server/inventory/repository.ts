import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { isDatabaseConfigured, withTenant } from "@/db/client";
import { inventoryItems, stockMovements } from "@/db/schema";
import type { InventoryItem } from "./schema";

export async function listItemsWithStock(tenantId: string): Promise<InventoryItem[]> {
  if (!isDatabaseConfigured()) return [];
  return withTenant(tenantId, (tx) =>
    tx
      .select({
        id: inventoryItems.id,
        sku: inventoryItems.sku,
        name: inventoryItems.name,
        unit: inventoryItems.unit,
        reorderLevel: inventoryItems.reorderLevel,
        onHand: sql<number>`coalesce(sum(${stockMovements.quantityDelta}), 0)::int`,
      })
      .from(inventoryItems)
      .leftJoin(stockMovements, eq(stockMovements.itemId, inventoryItems.id))
      .where(eq(inventoryItems.tenantId, tenantId))
      .groupBy(inventoryItems.id)
      .orderBy(asc(inventoryItems.name)),
  );
}
