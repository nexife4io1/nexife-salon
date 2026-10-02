"use server";

import { getTenantContext } from "@/server/shared/context";
import { AppError, notImplemented, validationError } from "@/server/shared/errors";
import { toActionError, type ActionResult } from "@/server/shared/result";
import { bookAppointmentInputSchema } from "./schema";

export async function bookAppointmentAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("appointments");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to appointments."));
  const parsed = bookAppointmentInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  // TODO(step 6): service.book(ctx.tenantId, parsed.data) + revalidatePath("/appointments")
  return toActionError(notImplemented("Booking appointments"));
}
