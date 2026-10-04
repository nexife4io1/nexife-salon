import { index, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, salon, timestamps } from "./_shared";

/**
 * Tenancy: tenants, their branches, and the users who sign in.
 * Every tenant-owned table carries `tenant_id`; RLS policies key off it
 * (see db/migrations/*_rls.sql).
 */

export const userRole = salon.enum("user_role", ["platform_admin", "owner", "manager", "staff"]);
export const branchStatus = salon.enum("branch_status", ["active", "inactive", "opening_soon"]);

export const tenants = salon.table("tenants", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("UTC"),
  ...timestamps(),
});

export const branches = salon.table(
  "branches",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    addressLine: text("address_line").notNull(),
    city: text("city"),
    phone: text("phone"),
    status: branchStatus("status").notNull().default("active"),
    ...timestamps(),
  },
  (t) => [index("branches_tenant_idx").on(t.tenantId)],
);

export const users = salon.table(
  "users",
  {
    id: id(),
    // Null only for platform admins, who operate across tenants.
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    username: text("username").notNull(),
    // scrypt hash produced by server/auth/password.ts — never plaintext.
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull(),
    // Menu grants for RBAC (see server/shared/rbac.ts). Empty = role defaults.
    menus: text("menus").array().notNull().default([]),
    ...timestamps(),
  },
  (t) => [uniqueIndex("users_username_uq").on(t.username), index("users_tenant_idx").on(t.tenantId)],
);
