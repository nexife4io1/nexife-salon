import "server-only";
import { requireTenantContext } from "@/server/shared/context";
import * as service from "./service";

export async function getStaffDirectory() {
  const ctx = await requireTenantContext("staff");
  const [staff, services] = await Promise.all([service.listStaff(ctx.tenantId), service.listServices(ctx.tenantId)]);
  return { staff, services };
}
