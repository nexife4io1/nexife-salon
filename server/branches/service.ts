import "server-only";
import { canManageBranches } from "@/server/shared/rbac";
import { AppError } from "@/server/shared/errors";
import type { TenantContext } from "@/server/shared/context";
// Cross-domain reads go through other domains' services — never their repositories.
import * as appointmentsService from "@/server/appointments/service";
import * as billingService from "@/server/billing/service";
import * as staffService from "@/server/staff/service";
import * as tenantsService from "@/server/tenants/service";
import * as repo from "./repository";
import type { Branch, BranchesOverview, BranchOverview, BranchServicesView, CreateBranchInput } from "./schema";

export async function getOverview(tenantId: string): Promise<BranchesOverview> {
  const [tenant, branches, staffCounts, appointmentCounts, revenue] = await Promise.all([
    tenantsService.getTenant(tenantId),
    repo.listByTenant(tenantId),
    staffService.countActiveByBranch(tenantId),
    appointmentsService.countTodayByBranch(tenantId),
    billingService.revenueTodayByBranch(tenantId),
  ]);

  const overview: BranchOverview[] = branches.map((branch) => ({
    ...branch,
    staffCount: staffCounts.get(branch.id) ?? 0,
    appointmentsToday: appointmentCounts.get(branch.id) ?? 0,
    revenueTodayCents: revenue.get(branch.id) ?? 0,
  }));

  return { branches: overview, currency: tenant.currency, source: repo.dataSource() };
}

export async function getBranch(tenantId: string, branchId: string): Promise<Branch> {
  const branch = await repo.findById(tenantId, branchId);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found.");
  return branch;
}

/** Active tenant services a branch can offer. */
export function listServiceOptions(tenantId: string) {
  return staffService.listServices(tenantId);
}

/** Reject ids that are not active services of this tenant (also stops cross-tenant ids). */
async function assertOfferable(tenantId: string, serviceIds: string[]): Promise<void> {
  const allowed = new Set((await listServiceOptions(tenantId)).map((s) => s.id));
  if (serviceIds.some((id) => !allowed.has(id))) {
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", { serviceIds: ["Choose from your active services"] });
  }
}

export async function createBranch(ctx: TenantContext, input: CreateBranchInput): Promise<Branch> {
  if (!canManageBranches(ctx.role)) throw new AppError("FORBIDDEN", "Only owners and managers can add branches.");
  // TODO(step 2): enforce unique branch name per tenant; plan-based branch limits.
  await assertOfferable(ctx.tenantId, input.serviceIds);
  return repo.insert(ctx.tenantId, { ...input, serviceIds: [...new Set(input.serviceIds)] });
}

export async function getBranchServices(ctx: TenantContext, branchId: string): Promise<BranchServicesView> {
  await getBranch(ctx.tenantId, branchId);
  const [tenant, options, offered] = await Promise.all([
    tenantsService.getTenant(ctx.tenantId),
    listServiceOptions(ctx.tenantId),
    repo.listOfferedServiceIds(ctx.tenantId, branchId),
  ]);
  return {
    options,
    // Demo fixtures have no offerings table: show every service as offered.
    offeredIds: repo.dataSource() === "demo" ? options.map((s) => s.id) : offered,
    currency: tenant.currency,
    canManage: canManageBranches(ctx.role),
  };
}

export async function setBranchServices(ctx: TenantContext, branchId: string, serviceIds: string[]): Promise<void> {
  if (!canManageBranches(ctx.role)) throw new AppError("FORBIDDEN", "Only owners and managers can change a branch's services.");
  await getBranch(ctx.tenantId, branchId);
  await assertOfferable(ctx.tenantId, serviceIds);
  await repo.replaceOfferedServices(ctx.tenantId, branchId, [...new Set(serviceIds)]);
}
