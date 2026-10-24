import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getTenantContext, requireTenantContext } from "@/server/shared/context";
import { AppError } from "@/server/shared/errors";
import { parseAppointmentFilters, type PublicReview, type ReceiptReviewLinkView } from "./schema";
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

/** One appointment's services with their status, team and history. 404s for ids that aren't in the caller's tenant. */
export async function getAppointmentServices(id: string) {
  const ctx = await requireTenantContext("appointments");
  if (!z.string().uuid().safeParse(id).success) notFound();
  try {
    return await service.getServicesView(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

async function publicOrigin(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * The review link to print as a QR code on a receipt. Anyone who can see the receipt (billing) or the appointment
 * may ask for it. Set APP_URL to the public address of the app so QR codes never carry an internal host.
 */
export async function getReviewLinkForReceipt(appointmentId: string | null): Promise<ReceiptReviewLinkView> {
  if (!appointmentId || !z.string().uuid().safeParse(appointmentId).success) return { state: "unavailable" };
  const ctx = (await getTenantContext("billing")) ?? (await getTenantContext("appointments"));
  if (!ctx) return { state: "unavailable" };
  const link = await service.getReceiptReviewLink(ctx, appointmentId);
  if (link.state !== "open") return link;
  return { state: "open", url: `${await publicOrigin()}/review/${link.token}`, expiresAt: link.expiresAt };
}

/** What the public review page may show. No session; the signed token is the only credential. */
export async function getPublicReview(token: string): Promise<PublicReview> {
  return service.getPublicReview(token);
}
