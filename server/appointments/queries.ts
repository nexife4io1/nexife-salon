import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getTenantContext, requireTenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
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

/** An existing booking for the edit form. 404s when missing; redirects back when it can no longer be edited. */
export async function getEditableAppointment(id: string) {
  const ctx = await requireTenantContext("appointments");
  if (!z.string().uuid().safeParse(id).success) notFound();
  try {
    return await service.getEditable(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    if (error instanceof AppError && error.code === "CONFLICT") redirect("/appointments");
    throw error;
  }
}

/** A customer's appointments (newest first) for their profile; empty when the caller can't see appointments. */
export async function getCustomerAppointments(customerId: string) {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return [];
  return service.listForCustomer(ctx.tenantId, customerId);
}
