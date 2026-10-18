"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/server/shared/context";
import { AppError, validationError } from "@/server/shared/errors";
import { toActionError, type ActionResult } from "@/server/shared/result";
import { parseCheckoutPayload } from "./schema";
import * as service from "./service";

/**
 * Record payment for a completed appointment and open its receipt. The checkout form posts its state as one JSON
 * `payload` field. Double submits land on the same receipt rather than creating a second one.
 */
export async function recordPaymentAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await getTenantContext("billing");
  if (!ctx) return toActionError(new AppError("FORBIDDEN", "You don't have access to billing."));

  const parsed = parseCheckoutPayload(formData.get("payload"));
  if (!parsed.success) return toActionError(validationError(parsed.error));

  let invoiceId: string;
  let customerId: string | null;
  try {
    ({ invoiceId, customerId } = await service.recordPayment(ctx, parsed.data));
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/billing");
  revalidatePath("/appointments");
  revalidatePath("/branches"); // branch cards show today's revenue
  if (customerId) revalidatePath(`/customers/${customerId}`);
  redirect(`/billing/receipts/${invoiceId}`); // outside try: redirect() works by throwing
}
