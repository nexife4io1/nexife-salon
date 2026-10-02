import "server-only";
import { requireTenantContext } from "@/server/shared/context";
import * as service from "./service";

export async function getBillingOverview() {
  const ctx = await requireTenantContext("billing");
  const [recent, byBranch] = await Promise.all([
    service.listRecentPayments(ctx.tenantId),
    service.revenueTodayByBranch(ctx.tenantId),
  ]);
  const revenueTodayCents = [...byBranch.values()].reduce((a, b) => a + b, 0);
  return { recent, revenueTodayCents };
}
