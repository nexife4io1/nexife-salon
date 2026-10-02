import "server-only";
import { requireTenantContext } from "@/server/shared/context";
import * as service from "./service";

export async function getDashboardSummary() {
  const ctx = await requireTenantContext("dashboard");
  return { ...(await service.getSummary(ctx.tenantId)), userName: ctx.session.name };
}
