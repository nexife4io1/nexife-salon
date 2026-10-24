import "server-only";
import { initials } from "@/lib/format";
import type { TenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
// Cross-domain reads go through other domains' services — never their repositories.
import * as branchesService from "@/server/branches/service";
import * as tenantsService from "@/server/tenants/service";
import { computeAvailability } from "./availability";
import * as repo from "./repository";
import { generateRegistrationCode } from "./registration-code";
import type { StaffProfileRow } from "./repository";
import type {
  StaffBranchOption,
  StaffFormOptions,
  StaffFilters,
  StaffInput,
  StaffListItem,
  StaffProfile,
  StaffStatus,
  StaffWrite,
  WorkingHours,
} from "./schema";
import { WEEKDAYS } from "./schema";

/** Public staff API for other domains (e.g. branches uses countActiveByBranch). */

export function countActiveByBranch(tenantId: string) {
  return repo.countActiveByBranch(tenantId);
}

export function listStaff(tenantId: string) {
  return repo.listStaff(tenantId);
}

/** staff id -> service ids they perform, for staff who declared any. Staff absent from the map are unrestricted. */
export function listServiceAssignments(tenantId: string) {
  return repo.listServiceAssignments(tenantId);
}

// --- Staff management ------------------------------------------------------------------------------

/** Profiles carry contact, salary and ID-adjacent data, so every read and write needs a staff manager. */
function assertCanManage(ctx: TenantContext): void {
  if (ctx.role !== "owner" && ctx.role !== "manager") throw new AppError("FORBIDDEN", "Only owners and managers can manage staff.");
}

export function canManageStaff(ctx: TenantContext): boolean {
  return ctx.role === "owner" || ctx.role === "manager";
}

async function branchOptions(tenantId: string): Promise<StaffBranchOption[]> {
  const { branches } = await branchesService.getOverview(tenantId);
  return branches.map((b) => ({ id: b.id, name: b.name, status: b.status }));
}

export type StaffDirectoryView = {
  staff: StaffListItem[];
  branches: StaffBranchOption[];
  source: "database" | "demo";
  /** True when any filter is applied (lets the UI say "no matches" instead of "no staff yet"). */
  filtered: boolean;
};

function toListItem(row: repo.StaffDirectoryRow, branchNames: Map<string, string>, timezone: string, now: Date): StaffListItem {
  const { schedule, ...rest } = row;
  return {
    ...rest,
    branchName: row.branchId ? (branchNames.get(row.branchId) ?? null) : null,
    availability: computeAvailability({ status: row.status, schedule }, now, timezone),
  };
}

export async function getDirectory(ctx: TenantContext, filters: StaffFilters, now = new Date()): Promise<StaffDirectoryView> {
  assertCanManage(ctx);
  const [tenant, branches, rows] = await Promise.all([
    tenantsService.getTenant(ctx.tenantId),
    branchOptions(ctx.tenantId),
    repo.listDirectory(ctx.tenantId, filters),
  ]);
  const names = new Map(branches.map((b) => [b.id, b.name]));
  return {
    staff: rows.map((row) => toListItem(row, names, tenant.timezone, now)),
    branches,
    source: repo.dataSource(),
    filtered: Boolean(filters.q || filters.branchId || filters.status),
  };
}

export async function getFormOptions(ctx: TenantContext): Promise<StaffFormOptions> {
  assertCanManage(ctx);
  const [tenant, branches, services] = await Promise.all([
    tenantsService.getTenant(ctx.tenantId),
    branchOptions(ctx.tenantId),
    tenantsService.listTenantServices(ctx.tenantId),
  ]);
  const offered = await Promise.all(branches.map(async (b) => [b.id, (await branchesService.getBranchServices(ctx, b.id)).offeredIds] as const));
  return {
    branches,
    services: services.map((s) => ({ id: s.id, name: s.name, category: s.category, durationMinutes: s.durationMinutes, priceCents: s.priceCents })),
    offeredByBranch: Object.fromEntries(offered),
    currency: tenant.currency,
    source: repo.dataSource(),
  };
}

export async function getProfile(ctx: TenantContext, staffId: string, now = new Date()): Promise<StaffProfile> {
  assertCanManage(ctx);
  const [tenant, branches, row] = await Promise.all([
    tenantsService.getTenant(ctx.tenantId),
    branchOptions(ctx.tenantId),
    repo.findProfile(ctx.tenantId, staffId),
  ]);
  if (!row) throw new AppError("NOT_FOUND", "Staff member not found.");
  const { schedule, ...rest }: StaffProfileRow = row;
  const names = new Map(branches.map((b) => [b.id, b.name]));
  return {
    ...rest,
    schedule,
    branchName: row.branchId ? (names.get(row.branchId) ?? null) : null,
    availability: computeAvailability({ status: row.status, schedule }, now, tenant.timezone),
  };
}

/** Validate the selected branch, then normalise the form to the write model. */
async function buildWrite(ctx: TenantContext, input: StaffInput, currentBranchId: string | null): Promise<StaffWrite> {
  const fieldErrors: Record<string, string[]> = {};

  try {
    const branch = await branchesService.getBranch(ctx.tenantId, input.branchId);
    // Keep an existing assignment editable even if the branch has since been deactivated.
    if (branch.status === "inactive" && branch.id !== currentBranchId) fieldErrors.branchId = ["That branch is inactive"];
  } catch (error) {
    if (!(error instanceof AppError && error.code === "NOT_FOUND")) throw error;
    fieldErrors.branchId = ["Choose one of your branches"];
  }

  // Services: active catalog services that the staff member's own branch offers.
  if (input.serviceIds.length && !fieldErrors.branchId) {
    const { offeredIds } = await branchesService.getBranchServices(ctx, input.branchId);
    const allowed = new Set((await tenantsService.listTenantServices(ctx.tenantId)).filter((s) => offeredIds.includes(s.id)).map((s) => s.id));
    if (input.serviceIds.some((id) => !allowed.has(id))) fieldErrors.serviceIds = ["Choose services this branch offers"];
  }

  if (Object.keys(fieldErrors).length) throw new AppError("VALIDATION", "Please fix the highlighted fields.", fieldErrors);

  const weeklyOffDay = input.weeklyOff ? WEEKDAYS.indexOf(input.weeklyOff) : null;
  const hours: WorkingHours[] = [];
  if (input.shiftStart && input.shiftEnd) {
    for (let day = 0; day < 7; day++) {
      if (day !== weeklyOffDay) hours.push({ day, start: input.shiftStart, end: input.shiftEnd });
    }
  }

  return {
    name: input.name,
    initials: initials(input.name),
    title: input.title ?? null,
    branchId: input.branchId,
    jobRole: input.jobRole ?? null,
    status: input.status,
    phone: input.phone ?? null,
    gender: input.gender ?? null,
    address: input.address ?? null,
    emergencyContactName: input.emergencyContactName ?? null,
    emergencyContactPhone: input.emergencyContactPhone ?? null,
    monthlySalaryCents: input.monthlySalaryCents ?? null,
    yearsExperience: input.yearsExperience ?? null,
    joinedOn: input.joinedOn ?? null,
    casualLeaves: input.casualLeaves ?? null,
    recruitmentSource: input.recruitmentSource ?? null,
    weeklyOffDay,
    hours,
    serviceIds: input.serviceIds,
    breaks: [...input.breaks].sort((a, b) => a.start.localeCompare(b.start)).map((b) => ({ label: b.label ?? null, start: b.start, end: b.end })),
  };
}

export async function createStaff(ctx: TenantContext, input: StaffInput): Promise<{ id: string }> {
  assertCanManage(ctx);
  repo.assertWritable();
  const write = await buildWrite(ctx, input, null);
  return { id: await repo.insertStaff(ctx.tenantId, write) };
}

export async function updateStaff(ctx: TenantContext, staffId: string, input: StaffInput): Promise<void> {
  assertCanManage(ctx);
  repo.assertWritable();
  const existing = await repo.findProfile(ctx.tenantId, staffId);
  if (!existing) throw new AppError("NOT_FOUND", "Staff member not found.");
  const write = await buildWrite(ctx, input, existing.branchId);
  if (!(await repo.updateStaff(ctx.tenantId, staffId, write))) throw new AppError("NOT_FOUND", "Staff member not found.");
}

export async function setStatus(ctx: TenantContext, staffId: string, status: StaffStatus): Promise<void> {
  assertCanManage(ctx);
  repo.assertWritable();
  if (!(await repo.setStatus(ctx.tenantId, staffId, status))) throw new AppError("NOT_FOUND", "Staff member not found.");
}

// --- Device registration ---------------------------------------------------------------------------

const CODE_ATTEMPTS = 5;

/** Generate (or replace) the staff member's attendance registration code and return it. */
export async function regenerateRegistrationCode(ctx: TenantContext, staffId: string): Promise<string> {
  assertCanManage(ctx);
  repo.assertWritable();
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = generateRegistrationCode();
    const result = await repo.setRegistrationCode(ctx.tenantId, staffId, code);
    if (result === "ok") return code;
    if (result === "not_found") throw new AppError("NOT_FOUND", "Staff member not found.");
    if (result === "no_branch") throw new AppError("VALIDATION", "Assign this staff member to a branch before generating a code.");
    // "taken": a freak collision within the tenant; draw again.
  }
  throw new AppError("INTERNAL", "Could not generate a unique code. Please try again.");
}

export type DeviceStaff = { id: string; name: string; branchId: string | null; status: StaffStatus; phone: string | null };

/**
 * Backend-only lookup for the attendance domain. Callers must have authenticated the device user themselves
 * (registration code + phone); it is not a manager read, so it does no role check.
 */
export function findByRegistrationCode(tenantId: string, code: string): Promise<DeviceStaff | null> {
  return repo.findByRegistrationCode(tenantId, code);
}
