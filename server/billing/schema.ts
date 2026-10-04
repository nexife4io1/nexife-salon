import { z } from "zod";

export const paymentMethodSchema = z.enum(["cash", "card", "upi", "wallet", "other"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  appointmentId: z.string().nullable(),
  amountCents: z.number().int(),
  method: paymentMethodSchema,
  paidAt: z.date(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const recordPaymentInputSchema = z.object({
  appointmentId: z.string().uuid(),
  amountCents: z.coerce.number().int().positive(),
  method: paymentMethodSchema,
});
export type RecordPaymentInput = z.infer<typeof recordPaymentInputSchema>;
