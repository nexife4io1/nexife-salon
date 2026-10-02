"use server";

import { getTenantContext } from "@/server/shared/context";
import { AppError, notImplemented, validationError } from "@/server/shared/errors";
import { toActionError, type ActionResult } from "@/server/shared/result";
import { recordStockMovementInputSchema } from "./schema";

export async function recordStockMovementAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("inventory");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to inventory."));
  const parsed = recordStockMovementInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  // TODO(step 8): service.recordMovement(ctx.tenantId, parsed.data) + revalidatePath("/inventory")
  return toActionError(notImplemented("Stock movements"));
}
