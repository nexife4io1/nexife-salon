"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/server/shared/context";
import { AppError, validationError } from "@/server/shared/errors";
import { ok, toActionError, type ActionResult } from "@/server/shared/result";
import { createBranchInputSchema, setBranchServicesInputSchema } from "./schema";
import * as service from "./service";

/** Create a branch, then redirect to it. Returns an ActionResult only on failure. */
export async function createBranchAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("branches");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to branches."));

  const parsed = createBranchInputSchema.safeParse({ ...Object.fromEntries(formData), serviceIds: formData.getAll("serviceIds") });
  if (!parsed.success) return toActionError(validationError(parsed.error));

  let branchId: string;
  try {
    branchId = (await service.createBranch(ctx, parsed.data)).id;
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/branches");
  redirect(`/branches/${branchId}`); // outside try: redirect() works by throwing
}

/** Replace the set of services a branch offers (checkboxes named `serviceIds`). */
export async function setBranchServicesAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("branches");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to branches."));

  const parsed = setBranchServicesInputSchema.safeParse({ branchId: formData.get("branchId"), serviceIds: formData.getAll("serviceIds") });
  if (!parsed.success) return toActionError(validationError(parsed.error));

  try {
    await service.setBranchServices(ctx, parsed.data.branchId, parsed.data.serviceIds);
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/branches/${parsed.data.branchId}`);
  return ok(undefined);
}
