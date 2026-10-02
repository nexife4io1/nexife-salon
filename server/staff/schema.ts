import { z } from "zod";

/** Staff + Services are built together (roadmap step 4); the service catalog lives in this domain. */

export const staffMemberSchema = z.object({
  id: z.string(),
  branchId: z.string().nullable(),
  name: z.string(),
  initials: z.string(),
  title: z.string().nullable(),
  active: z.boolean(),
});
export type StaffMember = z.infer<typeof staffMemberSchema>;

export const salonServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  durationMinutes: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
});
export type SalonService = z.infer<typeof salonServiceSchema>;

export const createStaffInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  title: z.string().trim().max(60).optional(),
  branchId: z.string().uuid().optional(),
});
export type CreateStaffInput = z.infer<typeof createStaffInputSchema>;
