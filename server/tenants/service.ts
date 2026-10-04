import "server-only";
import { AppError } from "@/server/shared/errors";
import * as repo from "./repository";
import type { Tenant, TenantUser } from "./schema";

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

// TODO(step 1): onboardTenant() — insert tenant + first owner in one transaction.
// TODO(step 10): createTenantUser(), updateMenuGrants() with password hashing via lib/password.
