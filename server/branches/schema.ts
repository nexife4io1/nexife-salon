import { z } from "zod";

export const BRANCH_STATUSES = ["active", "inactive", "opening_soon"] as const;
export const branchStatusSchema = z.enum(BRANCH_STATUSES);
export type BranchStatus = z.infer<typeof branchStatusSchema>;

export const branchSchema = z.object({
  id: z.string(),
  name: z.string(),
  addressLine: z.string(),
  city: z.string().nullable(),
  phone: z.string().nullable().optional(),
  status: branchStatusSchema,
});
export type Branch = z.infer<typeof branchSchema>;

/** A branch plus today's activity — what the Branches page renders per card. */
export type BranchOverview = Branch & {
  staffCount: number;
  appointmentsToday: number;
  revenueTodayCents: number;
};

export type BranchesOverview = {
  branches: BranchOverview[];
  currency: string;
  /** "demo" = read-only fixtures because DATABASE_URL is not configured. */
  source: "database" | "demo";
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

export const createBranchInputSchema = z.object({
  name: z.string().trim().min(2, "Give the branch a name").max(80),
  addressLine: z.string().trim().min(3, "Add a street address").max(160),
  city: optionalText(80),
  phone: optionalText(32),
  status: branchStatusSchema.default("active"),
});
export type CreateBranchInput = z.infer<typeof createBranchInputSchema>;
