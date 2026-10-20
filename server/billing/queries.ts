import "server-only";
import { notFound } from "next/navigation";
import { getTenantContext, requireTenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
import { invoiceIdSchema, parseBillingFilters } from "./schema";
import * as service from "./service";

/** 404s for malformed ids and for records that don't exist in the caller's tenant. */
async function orNotFound<T>(id: string, read: () => Promise<T>): Promise<T> {
  if (!invoiceIdSchema.safeParse(id).success) notFound();
  try {
    return await read();
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

/** `rawFilters` are the page's search params (currently `branchId`, which narrows the payment history). */
export async function getBillingOverview(rawFilters: Record<string, string | string[] | undefined> = {}) {
  const ctx = await requireTenantContext("billing");
  return service.getOverview(ctx.tenantId, new Date(), parseBillingFilters(rawFilters));
}

/** Everything the checkout screen needs for one appointment. */
export async function getCheckoutView(appointmentId: string) {
  const ctx = await requireTenantContext("billing");
  return orNotFound(appointmentId, () => service.getCheckout(ctx, appointmentId));
}

/** The printable receipt. Only exists for a payment that was recorded. */
export async function getReceiptView(invoiceId: string) {
  const ctx = await requireTenantContext("billing");
  return orNotFound(invoiceId, () => service.getReceipt(ctx, invoiceId));
}

/**
 * Billing state for a page that lists appointments (the board, a customer profile). Callers without billing
 * access (e.g. the staff role) get `canCheckout: false` and no receipts rather than a redirect.
 */
export async function getAppointmentBillingState(appointmentIds: string[]) {
  const ctx = await getTenantContext("billing");
  if (!ctx) return { canCheckout: false, receipts: {} as Record<string, string> };
  const receipts = await service.invoiceIdsByAppointment(ctx.tenantId, appointmentIds);
  return { canCheckout: true, receipts: Object.fromEntries(receipts) };
}

/** A customer's receipts for their profile; null when the caller can't see billing. */
export async function getCustomerInvoices(customerId: string) {
  const ctx = await getTenantContext("billing");
  if (!ctx) return null;
  return service.getCustomerBilling(ctx.tenantId, customerId);
}
