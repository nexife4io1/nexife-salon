import type { IconName } from "@/components/ui/icon";

/**
 * Sidebar navigation. `key` matches server/shared/rbac.ts MenuKey; the shell
 * only renders items the server says the user may access.
 */
export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  /** "feature" renders as the champagne CTA (mockup: "AI Style Studio"). */
  kind?: "link" | "feature";
  group: "operate" | "manage" | "admin";
};

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard", group: "operate" },
  { key: "appointments", label: "Appointments", href: "/appointments", icon: "calendar", group: "operate" },
  { key: "customers", label: "Customers", href: "/customers", icon: "users", group: "operate" },
  { key: "billing", label: "Billing", href: "/billing", icon: "receipt", group: "operate" },
  { key: "staff", label: "Staff & Services", href: "/staff", icon: "scissors", group: "manage" },
  { key: "branches", label: "Branches", href: "/branches", icon: "store", group: "manage" },
  { key: "inventory", label: "Inventory", href: "/inventory", icon: "package", group: "manage" },
  { key: "finance", label: "Finance", href: "/finance", icon: "chart", group: "manage" },
  { key: "assistant", label: "AI Style Studio", href: "/assistant", icon: "sparkles", kind: "feature", group: "manage" },
  { key: "users", label: "Users & Access", href: "/users", icon: "shield", group: "admin" },
  { key: "platform", label: "Tenants", href: "/platform", icon: "building", group: "admin" },
];
