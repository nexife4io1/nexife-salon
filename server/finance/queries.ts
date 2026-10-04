import "server-only";
import { requireTenantContext } from "@/server/shared/context";
import * as service from "./service";

export async function getFinanceSummary() {
  const ctx = await requireTenantContext("finance");
  return service.getMonthToDate(ctx.tenantId);
}
