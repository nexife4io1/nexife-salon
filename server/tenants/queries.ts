import "server-only";
import { getSession } from "@/server/shared/session";
import { requirePlatformAdmin, requireTenantContext } from "@/server/shared/context";
import * as service from "./service";

/** Tenant shown in the app shell; null for platform admins (no tenant). */
export async function getCurrentTenant() {
  const session = await getSession();
  return session?.tid ? service.getTenant(session.tid) : null;
}

export async function getTenantUsers() {
  const ctx = await requireTenantContext("users");
  return service.listTenantUsers(ctx.tenantId);
}

export async function getPlatformTenants() {
  await requirePlatformAdmin();
  return service.listTenants();
}
