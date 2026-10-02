import { z } from "zod";

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  visitCount: z.number().int(),
});
export type Customer = z.infer<typeof customerSchema>;

export const customerSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CustomerSearch = z.infer<typeof customerSearchSchema>;

export const createCustomerInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;
