import "server-only";
import { notFound } from "next/navigation";
import { requireTenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
import { customerIdSchema, parseCustomerFilters } from "./schema";
import * as service from "./service";

/** Server Component reads. Every entry point is authenticated, RBAC-checked and tenant-scoped. */

export async function getCustomers(q?: string) {
  const ctx = await requireTenantContext("customers");
  return service.searchCustomers(ctx.tenantId, { q });
}

export async function getCustomerDirectory(rawFilters: Record<string, string | string[] | undefined> = {}) {
  const ctx = await requireTenantContext("customers");
  const filters = parseCustomerFilters(rawFilters);
  const directory = await service.getDirectory(ctx.tenantId, filters);
  return { ...directory, filters: { ...filters, page: directory.page } };
}

/** 404s for malformed ids and for customers that don't exist in the caller's tenant. */
export async function getCustomerProfile(customerId: string) {
  const ctx = await requireTenantContext("customers");
  if (!customerIdSchema.safeParse(customerId).success) notFound();
  try {
    return await service.getProfile(ctx.tenantId, customerId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

/** Whether writes are possible (false in read-only demo mode), for add/edit pages. */
export async function getCustomerFormOptions() {
  await requireTenantContext("customers");
  return { source: service.dataSource() };
}
