"use server";

import { getTenantContext } from "@/server/shared/context";
import { AppError, notImplemented, validationError } from "@/server/shared/errors";
import { toActionError, type ActionResult } from "@/server/shared/result";
import { createCustomerInputSchema } from "./schema";

export async function createCustomerAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("customers");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to customers."));
  const parsed = createCustomerInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  // TODO(step 5): service.createCustomer(ctx.tenantId, parsed.data) + revalidatePath("/customers")
  return toActionError(notImplemented("Adding customers"));
}
