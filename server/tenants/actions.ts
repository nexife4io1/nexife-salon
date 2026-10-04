"use server";

import { getTenantContext } from "@/server/shared/context";
import { notImplemented, AppError } from "@/server/shared/errors";
import { toActionError, type ActionResult } from "@/server/shared/result";

/** Placeholder entry point for Users & Access → "Invite user". Wire in step 10. */
export async function inviteUserAction(_prev: ActionResult | undefined, _formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("users");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to manage users."));
  return toActionError(notImplemented("Inviting users"));
}
