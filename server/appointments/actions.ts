"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/server/shared/context";
import { AppError, validationError } from "@/server/shared/errors";
import { ok, toActionError, type ActionResult } from "@/server/shared/result";
import { appointmentsHref, bookAppointmentInputSchema, changeAppointmentStatusInputSchema } from "./schema";
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
