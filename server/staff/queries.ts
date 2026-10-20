import "server-only";
import { notFound } from "next/navigation";
import { requireTenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
import * as service from "./service";
import { parseStaffFilters } from "./schema";

/** Server Component reads. Staff data is restricted to owners/managers (enforced in the service). */

export async function getStaffDirectory(rawFilters: Record<string, string | string[] | undefined> = {}) {
  const ctx = await requireTenantContext("staff");
  const filters = parseStaffFilters(rawFilters);
  const view = await service.getDirectory(ctx, filters);
  return { ...view, filters, canManage: service.canManageStaff(ctx) };
}

/** Branch options for the add/edit form. */
export async function getStaffFormOptions() {
  const ctx = await requireTenantContext("staff");
  return service.getFormOptions(ctx);
}

export async function getStaffProfile(staffId: string) {
  const ctx = await requireTenantContext("staff");
  try {
    return await service.getProfile(ctx, staffId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
