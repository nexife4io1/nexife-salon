import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/server/shared/session";
import { requirePlatformAdmin, requireTenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
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
  return service.listTenantSummaries();
}

/** "demo" when DATABASE_URL is unset and the platform pages are showing read-only fixtures. */
export async function getPlatformDataSource() {
  await requirePlatformAdmin();
  return service.dataSource();
}

export async function getPlatformTenant(tenantId: string) {
  await requirePlatformAdmin();
  if (!z.string().uuid().safeParse(tenantId).success) notFound();
  try {
    return await service.getTenantDetail(tenantId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export async function getServiceTemplates() {
  await requirePlatformAdmin();
  return service.listServiceTemplates();
}
