import type { Role } from "./session-token";

/**
 * Central RBAC: role defaults + per-user menu grants. Every query/action goes
 * through `canAccess` (via context.ts) instead of re-implementing guards.
 *
 * TODO(step 10 — Users/RBAC): load grants from the users table and add
 * action-level permissions (e.g. "billing:refund") alongside menu access.
 */

export const MENU_KEYS = [
  "dashboard",
  "branches",
  "appointments",
  "customers",
  "staff",
  "billing",
  "inventory",
  "finance",
  "assistant",
  "users",
  "platform",
  "platform_services",
] as const;
export type MenuKey = (typeof MENU_KEYS)[number];

const ROLE_DEFAULT_MENUS: Record<Role, readonly MenuKey[]> = {
  platform_admin: ["platform", "platform_services"],
  owner: ["dashboard", "branches", "appointments", "customers", "staff", "billing", "inventory", "finance", "assistant", "users"],
  manager: ["dashboard", "branches", "appointments", "customers", "staff", "billing", "inventory", "assistant"],
  staff: ["dashboard", "appointments", "customers", "assistant"],
};

export function isMenuKey(value: string): value is MenuKey {
  return (MENU_KEYS as readonly string[]).includes(value);
}

/** Explicit grants (if any) narrow the role defaults; they never widen them. */
export function allowedMenus(subject: { role: Role; menus?: readonly string[] }): MenuKey[] {
  const defaults = ROLE_DEFAULT_MENUS[subject.role];
  const grants = (subject.menus ?? []).filter(isMenuKey);
  return grants.length ? defaults.filter((m) => grants.includes(m)) : [...defaults];
}

export function canAccess(subject: { role: Role; menus?: readonly string[] }, menu: MenuKey): boolean {
  return allowedMenus(subject).includes(menu);
}

export function homePathFor(subject: { role: Role; menus?: readonly string[] }): string {
  const [first] = allowedMenus(subject);
  return first ? `/${first}` : "/login";
}

export function canManageBranches(role: Role): boolean {
  return role === "owner" || role === "manager";
}
