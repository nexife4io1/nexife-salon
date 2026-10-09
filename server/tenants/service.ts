import "server-only";
import { hashPassword } from "@/lib/password";
import { AppError } from "@/server/shared/errors";
import * as repo from "./repository";
import type {
  AddTenantServicesInput,
  CreateServiceTemplateInput,
  OnboardTenantInput,
  ServiceTemplate,
  Tenant,
  TenantDetail,
  TenantService,
  TenantSummary,
  TenantUser,
  UpdateServiceTemplateInput,
  UpdateTenantServiceInput,
} from "./schema";

export const dataSource = repo.dataSource;

export async function getTenant(tenantId: string): Promise<Tenant> {
  const tenant = await repo.findTenantById(tenantId);
  if (!tenant) throw new AppError("NOT_FOUND", "Tenant not found.");
  return tenant;
}

export function listTenants(): Promise<Tenant[]> {
  return repo.listTenants();
}

export function listTenantUsers(tenantId: string): Promise<TenantUser[]> {
  return repo.listUsersByTenant(tenantId);
}

// --- Platform administration (callers must already have verified a platform admin) ---

export function listTenantSummaries(): Promise<TenantSummary[]> {
  return repo.listTenantSummaries();
}

export async function getTenantDetail(tenantId: string): Promise<TenantDetail> {
  const detail = await repo.findTenantDetail(tenantId);
  if (!detail) throw new AppError("NOT_FOUND", "Tenant not found.");
  return detail;
}

/** Creates tenant + first owner + first branch + services in one transaction; returns the tenant id. */
export async function onboardTenant(input: OnboardTenantInput): Promise<string> {
  const { confirmPassword: _confirm, password, ...owner } = input.owner;
  return repo.onboardTenant({
    tenant: input.tenant,
    owner: { ...owner, passwordHash: await hashPassword(password) },
    branch: input.branch,
    services: input.services,
  });
}

export function listServiceTemplates(): Promise<ServiceTemplate[]> {
  return repo.listServiceTemplates();
}

export function createServiceTemplate(input: CreateServiceTemplateInput): Promise<ServiceTemplate> {
  return repo.createServiceTemplate(input);
}

export async function updateServiceTemplate(input: UpdateServiceTemplateInput): Promise<ServiceTemplate> {
  const template = await repo.updateServiceTemplate(input);
  if (!template) throw new AppError("NOT_FOUND", "Service template not found.");
  return template;
}

export async function setServiceTemplateActive(id: string, active: boolean): Promise<ServiceTemplate> {
  const template = await repo.setServiceTemplateActive(id, active);
  if (!template) throw new AppError("NOT_FOUND", "Service template not found.");
  return template;
}

export async function addTenantServices({ tenantId, services }: AddTenantServicesInput): Promise<void> {
  await getTenant(tenantId); // NOT_FOUND for unknown tenants rather than an FK error
  await repo.addTenantServices(tenantId, services);
}

export async function updateTenantService(input: UpdateTenantServiceInput): Promise<TenantService> {
  const service = await repo.updateTenantService(input);
  if (!service) throw new AppError("NOT_FOUND", "Service not found for this tenant.");
  return service;
}

// TODO(step 10): createTenantUser(), updateMenuGrants() with password hashing via lib/password.
