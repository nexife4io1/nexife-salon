"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/server/shared/context";
import { AppError, validationError } from "@/server/shared/errors";
import { toActionError, type ActionResult } from "@/server/shared/result";
import { customerIdSchema, customerInputSchema } from "./schema";
import * as service from "./service";

const FORBIDDEN = "You don't have access to customers.";

export async function createCustomerAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("customers");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));

  const parsed = customerInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));

  let id: string;
  try {
    ({ id } = await service.createCustomer(ctx.tenantId, parsed.data));
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/customers");
  // Added from the booking form: go back to it with the new customer selected.
  redirect(formData.get("returnTo") === "booking" ? `/appointments/new?customerId=${id}` : `/customers/${id}`); // outside try: redirect() works by throwing
}

export async function updateCustomerAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("customers");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", FORBIDDEN));

  const idResult = customerIdSchema.safeParse(formData.get("id"));
  if (!idResult.success) return toActionError(new AppError("NOT_FOUND", "Customer not found."));
  const parsed = customerInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionError(validationError(parsed.error));

  try {
    await service.updateCustomer(ctx.tenantId, idResult.data, parsed.data);
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${idResult.data}`);
  redirect(`/customers/${idResult.data}`);
}
