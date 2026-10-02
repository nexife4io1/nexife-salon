"use server";

import { getTenantContext } from "@/server/shared/context";
import { AppError, notImplemented, validationError } from "@/server/shared/errors";
import { toActionError, type ActionResult } from "@/server/shared/result";
import { createStaffInputSchema } from "./schema";

export async function createStaffAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("staff");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to manage staff."));
  const parsed = createStaffInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));
  // TODO(step 4): service.createStaff(ctx.tenantId, parsed.data) + revalidatePath("/staff")
  return toActionError(notImplemented("Adding staff"));
}
