import "server-only";
import * as repo from "./repository";

export async function getStockOverview(tenantId: string) {
  const items = await repo.listItemsWithStock(tenantId);
  return { items, lowStock: items.filter((i) => i.onHand <= i.reorderLevel) };
}

// TODO(step 8): recordMovement(), item CRUD, auto-deduct on service completion (via appointments service).
