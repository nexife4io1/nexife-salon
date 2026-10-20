"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/server/shared/context";
import { AppError, validationError } from "@/server/shared/errors";
import { ok, toActionError, type ActionResult } from "@/server/shared/result";
import { appointmentsHref, bookAppointmentInputSchema, changeAppointmentStatusInputSchema, deleteAppointmentInputSchema } from "./schema";
import * as service from "./service";

const FORBIDDEN = "You don't have access to appointments.";

export async function bookAppointmentAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));

  const parsed = bookAppointmentInputSchema.safeParse({ ...Object.fromEntries(formData), serviceId: formData.getAll("serviceId") });
  if (!parsed.success) return toActionError(validationError(parsed.error));

  let date: string;
  try {
    ({ date } = await service.book(ctx, parsed.data));
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/appointments");
  revalidatePath("/branches"); // branch cards show today's appointment count
  redirect(appointmentsHref({ date, branchId: parsed.data.branchId })); // outside try: redirect() works by throwing
}

/** Reschedule / edit an existing booking. Takes the same fields as booking, plus the appointment `id`. */
export async function updateAppointmentAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));

  const id = deleteAppointmentInputSchema.shape.id.safeParse(formData.get("id"));
  if (!id.success) return toActionError(new AppError("NOT_FOUND", "Appointment not found."));
  const parsed = bookAppointmentInputSchema.safeParse({ ...Object.fromEntries(formData), serviceId: formData.getAll("serviceId"), type: "booking" });
  if (!parsed.success) return toActionError(validationError(parsed.error));

  let date: string;
  try {
    ({ date } = await service.updateBooking(ctx, id.data, parsed.data));
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/appointments");
  revalidatePath("/branches");
  redirect(appointmentsHref({ date, branchId: parsed.data.branchId })); // outside try: redirect() works by throwing
}

/** Permanently delete an appointment. Billing records already issued for it are kept. */
export async function deleteAppointmentAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));

  const parsed = deleteAppointmentInputSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return toActionError(validationError(parsed.error));

  let customerId: string | null;
  try {
    ({ customerId } = await service.deleteAppointment(ctx, parsed.data.id));
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/appointments");
  revalidatePath("/branches");
  revalidatePath("/billing"); // a deleted completed appointment leaves the awaiting-payment list
  if (customerId) revalidatePath(`/customers/${customerId}`);
  return ok(undefined);
}

/** Check-in, start service, complete, cancel or no-show. Illegal moves come back as a CONFLICT result. */
export async function changeAppointmentStatusAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));

  const parsed = changeAppointmentStatusInputSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return toActionError(validationError(parsed.error));

  try {
    await service.changeStatus(ctx, parsed.data);
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/appointments");
  revalidatePath("/branches");
  return ok(undefined);
}
