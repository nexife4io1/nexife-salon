"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/server/shared/context";
import { AppError, validationError } from "@/server/shared/errors";
import { ok, toActionError, type ActionResult } from "@/server/shared/result";
import {
  addServiceLineInputSchema,
  appointmentsHref,
  bookAppointmentInputSchema,
  changeAppointmentStatusInputSchema,
  changeServiceLineStatusInputSchema,
  customerSearchQuerySchema,
  deleteAppointmentInputSchema,
  reassignServiceLineInputSchema,
  removeServiceLineInputSchema,
  reviewInputFromForm,
  submitReviewInputSchema,
  type CustomerChoice,
} from "./schema";
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

/** Customer picker search: name or phone fragment -> a short list of matches across the whole directory. */
export async function searchCustomersAction(query: string): Promise<CustomerChoice[]> {
  const ctx = await getTenantContext("appointments");
  if (!ctx || !customerSearchQuerySchema.safeParse(query).success) return [];
  return service.searchCustomerChoices(ctx, query);
}

// --- Service lines -------------------------------------------------------------------------------------------

function refreshServices(appointmentId: string) {
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}/services`);
}

/** Add a service to an appointment that is checked in or in service. */
export async function addServiceLineAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));
  const parsed = addServiceLineInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  try {
    await service.addServiceLine(ctx, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  refreshServices(parsed.data.appointmentId);
  return ok(undefined);
}

export async function removeServiceLineAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));
  const parsed = removeServiceLineInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  try {
    await service.removeServiceLine(ctx, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  refreshServices(parsed.data.appointmentId);
  return ok(undefined);
}

/** Start or finish one service of an appointment. */
export async function changeServiceLineStatusAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));
  const parsed = changeServiceLineStatusInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  try {
    await service.changeServiceLineStatus(ctx, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  refreshServices(parsed.data.appointmentId);
  return ok(undefined);
}

/** Hand a service to another team member; after completion this is a logged correction that needs a reason. */
export async function reassignServiceLineAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));
  const parsed = reassignServiceLineInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  try {
    await service.reassignServiceLine(ctx, parsed.data);
  } catch (error) {
    return toActionError(error);
  }
  refreshServices(parsed.data.appointmentId);
  revalidatePath("/billing");
  return ok(undefined);
}

// --- Public review (no session: the signed link is the credential) -----------------------------------------------

const REVIEW_STATE_MESSAGES = {
  invalid: { code: "NOT_FOUND", message: "This review link isn't valid." },
  expired: { code: "CONFLICT", message: "This review link has expired." },
  submitted: { code: "CONFLICT", message: "A review has already been sent for this visit. Thank you!" },
} as const;

/** Store a customer's review. The only action in this file that does not require a signed-in user. */
export async function submitReviewAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = submitReviewInputSchema.safeParse(reviewInputFromForm(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  try {
    const outcome = await service.submitReview(parsed.data);
    if (!outcome.ok) {
      const { code, message } = REVIEW_STATE_MESSAGES[outcome.state];
      return toActionError(new AppError(code, message));
    }
  } catch (error) {
    return toActionError(error);
  }
  return ok(undefined);
}
