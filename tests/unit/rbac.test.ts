import { describe, expect, it } from "vitest";
import { allowedMenus, canAccess, homePathFor } from "@/server/shared/rbac";

describe("rbac", () => {
  it("gives owners every tenant menu but not platform", () => {
    expect(canAccess({ role: "owner" }, "finance")).toBe(true);
    expect(canAccess({ role: "owner" }, "platform")).toBe(false);
  });

  it("keeps staff out of finance and users", () => {
    expect(canAccess({ role: "staff" }, "finance")).toBe(false);
    expect(canAccess({ role: "staff" }, "users")).toBe(false);
    expect(canAccess({ role: "staff" }, "appointments")).toBe(true);
  });

  it("menu grants narrow but never widen role defaults", () => {
    expect(allowedMenus({ role: "staff", menus: ["appointments", "finance"] })).toEqual(["appointments"]);
  });

  it("routes platform admins to the platform area", () => {
    expect(homePathFor({ role: "platform_admin" })).toBe("/platform");
    expect(homePathFor({ role: "manager" })).toBe("/dashboard");
  });
});
