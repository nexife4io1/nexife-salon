"use server";

import { getTenantContext } from "@/server/shared/context";
import { AppError, notImplemented, validationError } from "@/server/shared/errors";
import { toActionError, type ActionResult } from "@/server/shared/result";
import { recordPaymentInputSchema } from "./schema";

export async function recordPaymentAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("billing");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to billing."));
  const parsed = recordPaymentInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  // TODO(step 7): service.recordPayment(ctx.tenantId, parsed.data) + revalidatePath("/billing")
  return toActionError(notImplemented("Recording payments"));
}
