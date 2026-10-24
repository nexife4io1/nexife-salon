"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/server/shared/context";
import { AppError, validationError } from "@/server/shared/errors";
import { ok, toActionError, type ActionResult } from "@/server/shared/result";
import { registrationCodeInputSchema, setStaffStatusInputSchema, staffInputSchema } from "./schema";
import * as service from "./service";

const FORBIDDEN = "You don't have access to manage staff.";

/** Collect the repeating `break*` inputs into rows, ignoring rows the user left completely blank. */
function readStaffForm(formData: FormData) {
  const labels = formData.getAll("breakLabel");
  const starts = formData.getAll("breakStart");
  const ends = formData.getAll("breakEnd");
  const breaks = starts
    .map((start, i) => ({ label: labels[i], start, end: ends[i] }))
    .filter((b) => String(b.start ?? "").trim() !== "" || String(b.end ?? "").trim() !== "");
  return { ...Object.fromEntries(formData), breaks, serviceIds: formData.getAll("serviceIds") };
}

export async function createStaffAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("staff");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));

  const parsed = staffInputSchema.safeParse(readStaffForm(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));

  try {
    await service.createStaff(ctx, parsed.data);
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/staff");
  revalidatePath("/branches"); // branch cards show staff counts
  redirect("/staff"); // outside try: redirect() works by throwing
}

export async function updateStaffAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("staff");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));

  const idResult = setStaffStatusInputSchema.shape.id.safeParse(formData.get("id"));
  if (!idResult.success) return toActionError(new AppError("NOT_FOUND", "Staff member not found."));
  const parsed = staffInputSchema.safeParse(readStaffForm(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));

  try {
    await service.updateStaff(ctx, idResult.data, parsed.data);
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/staff");
  revalidatePath(`/staff/${idResult.data}`);
  revalidatePath("/branches");
  redirect("/staff");
}

/** Change availability status (active / on leave / inactive) from the directory or profile. */
export async function setStaffStatusAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("staff");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));

  const parsed = setStaffStatusInputSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return toActionError(validationError(parsed.error));

  try {
    await service.setStatus(ctx, parsed.data.id, parsed.data.status);
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/staff");
  revalidatePath(`/staff/${parsed.data.id}`);
  revalidatePath("/branches");
  return ok(undefined);
}

/** Generate or regenerate the code a staff member uses on the mobile attendance page. */
export async function regenerateRegistrationCodeAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("staff");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));

  const parsed = registrationCodeInputSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return toActionError(new AppError("NOT_FOUND", "Staff member not found."));

  try {
    await service.regenerateRegistrationCode(ctx, parsed.data.id);
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/staff/${parsed.data.id}`);
  return ok(undefined);
}
