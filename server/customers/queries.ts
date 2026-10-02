import "server-only";
import { requireTenantContext } from "@/server/shared/context";
import * as service from "./service";

export async function getCustomers(q?: string) {
  const ctx = await requireTenantContext("customers");
  return service.searchCustomers(ctx.tenantId, { q });
}
