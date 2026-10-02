import { z } from "zod";

export const financeEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["income", "expense"]),
  category: z.string(),
  amountCents: z.number().int(),
  occurredOn: z.string(), // YYYY-MM-DD
  note: z.string().nullable(),
});
export type FinanceEntry = z.infer<typeof financeEntrySchema>;

export type FinanceSummary = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  entries: FinanceEntry[];
};

export const addFinanceEntryInputSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().trim().min(2).max(60),
  amountCents: z.coerce.number().int().positive(),
  occurredOn: z.iso.date(),
  note: z.string().max(200).optional(),
});
export type AddFinanceEntryInput = z.infer<typeof addFinanceEntryInputSchema>;
