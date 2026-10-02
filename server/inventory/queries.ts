import "server-only";
import { requireTenantContext } from "@/server/shared/context";
import * as service from "./service";

export async function getInventory() {
  const ctx = await requireTenantContext("inventory");
  return service.getStockOverview(ctx.tenantId);
}
