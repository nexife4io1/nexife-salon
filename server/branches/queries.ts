import "server-only";
import { notFound } from "next/navigation";
import { requireTenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
import { canManageBranches } from "@/server/shared/rbac";
import * as service from "./service";

export async function getBranchesOverview() {
  const ctx = await requireTenantContext("branches");
  const overview = await service.getOverview(ctx.tenantId);
  return { ...overview, canManage: canManageBranches(ctx.role) };
}

/** Active services a new branch can offer (for the Add Branch form). */
export async function getBranchServiceOptions() {
  const ctx = await requireTenantContext("branches");
  return service.listServiceOptions(ctx.tenantId);
}

export async function getBranchServicesView(branchId: string) {
  const ctx = await requireTenantContext("branches");
  try {
    return await service.getBranchServices(ctx, branchId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export async function getBranchDetail(branchId: string) {
  const ctx = await requireTenantContext("branches");
  try {
    return await service.getBranch(ctx.tenantId, branchId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
