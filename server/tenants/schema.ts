import { z } from "zod";
import { createBranchInputSchema, type Branch } from "@/server/branches/schema";
import { serviceAudienceSchema, type ServiceAudience } from "@/server/shared/audience";
import { ROLES } from "@/server/shared/session-token";

export const tenantSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  currency: z.string().length(3),
  timezone: z.string(),
});
export type Tenant = z.infer<typeof tenantSchema>;

/** A tenant's user as shown on Users & Access. Never includes the password hash. */
export const tenantUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  role: z.enum(ROLES),
  menus: z.array(z.string()),
});
export type TenantUser = z.infer<typeof tenantUserSchema>;

/** A row in the platform tenant directory. `createdAt` is an ISO string so it crosses the RSC boundary cleanly. */
export type TenantSummary = Tenant & {
  branchCount: number;
  userCount: number;
  serviceCount: number;
  createdAt: string;
};

/** A service associated with a tenant (a copy of a platform template, or tenant-made when templateId is null). */
export type TenantService = {
  id: string;
  templateId: string | null;
  name: string;
  category: string | null;
  audience: ServiceAudience;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
};

export type TenantDetail = Tenant & {
  createdAt: string;
  owners: TenantUser[];
  branches: Branch[];
  services: TenantService[];
};

export type ServiceTemplate = {
  id: string;
  name: string;
  category: string | null;
  audience: ServiceAudience;
  defaultDurationMinutes: number;
  defaultPriceCents: number;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Reference lists (computed once; the UI receives them as props from server pages
// so the server and client renders can never disagree).
// ---------------------------------------------------------------------------

// ICU lists some zones under legacy names (e.g. Asia/Calcutta). Add their current IANA names so admins can pick them.
const MODERN_ZONE_NAMES = ["Asia/Kolkata", "Asia/Kathmandu", "Asia/Ho_Chi_Minh", "Asia/Yangon", "Europe/Kyiv"].filter((tz) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
});

export const TIMEZONES: readonly string[] = [...new Set(["UTC", ...Intl.supportedValuesOf("timeZone"), ...MODERN_ZONE_NAMES])].sort((a, b) =>
  a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b),
);
export const CURRENCIES: readonly string[] = Intl.supportedValuesOf("currency");

const timezoneSet = new Set(TIMEZONES);
const currencySet = new Set(CURRENCIES);

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

const trimmedName = (label: string) => z.string().trim().min(2, `Enter ${label}`).max(80);

const priceCents = z.number({ error: "Enter a valid price" }).int("Enter a valid price").min(0, "Price can't be negative").max(100_000_00, "Price is too high");
const durationMinutes = z
  .number({ error: "Enter the duration in minutes" })
  .int("Enter whole minutes")
  .min(5, "At least 5 minutes")
  .max(600, "At most 600 minutes");

/** One service to associate with a tenant: a template plus the tenant's own price and duration. */
export const tenantServiceSelectionSchema = z.object({
  templateId: z.string().uuid(),
  priceCents,
  durationMinutes,
});
export type TenantServiceSelection = z.infer<typeof tenantServiceSelectionSchema>;

const serviceSelections = z
  .array(tenantServiceSelectionSchema)
  .min(1, "Pick at least one service")
  .refine((items) => new Set(items.map((i) => i.templateId)).size === items.length, "Each service can only be picked once");

export const onboardTenantInputSchema = z.object({
  tenant: z.object({
    name: trimmedName("the business name"),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{3,40}$/, "Use 3–40 lowercase letters, numbers or hyphens"),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter uppercase currency code")
      .refine((c) => currencySet.has(c), "Unknown currency code"),
    timezone: z.string().refine((tz) => timezoneSet.has(tz), "Choose a valid timezone"),
  }),
  owner: z
    .object({
      name: trimmedName("the owner's name"),
      username: z
        .string()
        .trim()
        .regex(/^[a-z0-9._-]{3,40}$/, "Use 3–40 lowercase letters, numbers, dots, dashes or underscores"),
      password: z.string().min(10, "Use at least 10 characters").max(200),
      confirmPassword: z.string(),
    })
    .refine((o) => o.password === o.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" }),
  // Same shape and messages as the Branches page; status always starts as "active".
  branch: createBranchInputSchema
    .pick({ name: true, addressLine: true, city: true, phone: true })
    // Which of the picked services this first branch offers (template ids).
    .extend({ offeredTemplateIds: z.array(z.string().uuid()).default([]) }),
  services: serviceSelections,
}).superRefine((input, ctx) => {
  const picked = new Set(input.services.map((s) => s.templateId));
  input.branch.offeredTemplateIds.forEach((id, i) => {
    if (!picked.has(id)) ctx.addIssue({ code: "custom", path: ["branch", "offeredTemplateIds", i], message: "Only picked services can be offered" });
  });
});
export type OnboardTenantInput = z.infer<typeof onboardTenantInputSchema>;

export const addTenantServicesInputSchema = z.object({
  tenantId: z.string().uuid(),
  services: serviceSelections,
});
export type AddTenantServicesInput = z.infer<typeof addTenantServicesInputSchema>;

export const updateTenantServiceInputSchema = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid(),
  priceCents,
  durationMinutes,
  active: z.boolean(),
});
export type UpdateTenantServiceInput = z.infer<typeof updateTenantServiceInputSchema>;

const optionalCategory = z
  .string()
  .trim()
  .max(60)
  .transform((v) => (v === "" ? null : v))
  .optional()
  .transform((v) => v ?? null);

export const createServiceTemplateInputSchema = z.object({
  name: z.string().trim().min(2, "Give the service a name").max(80),
  category: optionalCategory,
  audience: serviceAudienceSchema.default("unisex"),
  defaultDurationMinutes: durationMinutes,
  defaultPriceCents: priceCents,
});
export type CreateServiceTemplateInput = z.infer<typeof createServiceTemplateInputSchema>;

export const updateServiceTemplateInputSchema = createServiceTemplateInputSchema.extend({ id: z.string().uuid() });
export type UpdateServiceTemplateInput = z.infer<typeof updateServiceTemplateInputSchema>;

export const setServiceTemplateActiveInputSchema = z.object({ id: z.string().uuid(), active: z.boolean() });
export type SetServiceTemplateActiveInput = z.infer<typeof setServiceTemplateActiveInputSchema>;

// TODO(step 10): createTenantUserInputSchema (name, username, role, menus, temp password).
