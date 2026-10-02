import { z } from "zod";
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

// TODO(step 10): createTenantUserInputSchema (name, username, role, menus, temp password).
