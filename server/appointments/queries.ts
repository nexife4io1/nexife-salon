import "server-only";
import { requireTenantContext } from "@/server/shared/context";
import * as service from "./service";

export async function getTodaysAppointments() {
  const ctx = await requireTenantContext("appointments");
  return service.listToday(ctx.tenantId);
}
