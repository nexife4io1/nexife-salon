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

export async function getBranchDetail(branchId: string) {
  const ctx = await requireTenantContext("branches");
  try {
    return await service.getBranch(ctx.tenantId, branchId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
