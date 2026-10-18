import "server-only";
import { getTenantContext, requireTenantContext } from "@/server/shared/context";
import { parseAppointmentFilters } from "./schema";
import * as service from "./service";

export async function getTodaysAppointments() {
  const ctx = await requireTenantContext("appointments");
  return service.listToday(ctx.tenantId);
}

/** The day board for /appointments; `rawFilters` are the page's search params. */
export async function getAppointmentsBoard(rawFilters: Record<string, string | string[] | undefined> = {}) {
  const ctx = await requireTenantContext("appointments");
  return service.getBoard(ctx, parseAppointmentFilters(rawFilters));
}

/** Branch / service / staff / customer choices (and tenant-local "now") for the booking form. */
export async function getBookingFormOptions(customerId?: string) {
  const ctx = await requireTenantContext("appointments");
  return service.getBookingOptions(ctx, new Date(), customerId);
}

/** A customer's appointments (newest first) for their profile; empty when the caller can't see appointments. */
export async function getCustomerAppointments(customerId: string) {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return [];
  return service.listForCustomer(ctx.tenantId, customerId);
}
