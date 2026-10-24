import "server-only";
import { requireTenantContext } from "@/server/shared/context";
import * as service from "./service";

/** Server Component read for the staff profile: authn + RBAC + tenant scope, then the service. */
export async function getStaffAttendance(staffId: string) {
  const ctx = await requireTenantContext("staff");
  return service.listForStaff(ctx, staffId);
}
