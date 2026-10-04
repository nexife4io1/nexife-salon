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
import type { Branch, BranchesOverview, BranchOverview, CreateBranchInput } from "./schema";

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

export async function createBranch(ctx: TenantContext, input: CreateBranchInput): Promise<Branch> {
  if (!canManageBranches(ctx.role)) throw new AppError("FORBIDDEN", "Only owners and managers can add branches.");
  // TODO(step 2): enforce unique branch name per tenant; plan-based branch limits.
  return repo.insert(ctx.tenantId, input);
}
