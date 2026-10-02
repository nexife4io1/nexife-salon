"use server";

import { getTenantContext } from "@/server/shared/context";
import { AppError, notImplemented, validationError } from "@/server/shared/errors";
import { toActionError, type ActionResult } from "@/server/shared/result";
import { addFinanceEntryInputSchema } from "./schema";

export async function addFinanceEntryAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("finance");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to finance."));
  const parsed = addFinanceEntryInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  // TODO(step 9): service.addEntry(ctx.tenantId, parsed.data) + revalidatePath("/finance")
  return toActionError(notImplemented("Finance entries"));
}
