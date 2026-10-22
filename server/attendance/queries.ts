import "server-only";
import { requireTenantContext } from "@/server/shared/context";
import * as service from "./service";

export async function getAttendanceOverview(rawDate?: string) {
  const ctx = await requireTenantContext("attendance");
  return service.getOverview(ctx, rawDate);
}
