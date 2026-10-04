import { describe, expect, it } from "vitest";
import { createBranchInputSchema } from "@/server/branches/schema";

describe("createBranchInputSchema", () => {
  it("accepts a minimal branch and defaults status", () => {
    const parsed = createBranchInputSchema.parse({ name: "Downtown", addressLine: "124 Main St" });
    expect(parsed.status).toBe("active");
  });

  it("turns empty optional fields into undefined", () => {
    const parsed = createBranchInputSchema.parse({ name: "Downtown", addressLine: "124 Main St", city: "", phone: "  " });
    expect(parsed.city).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
  });

  it("rejects a missing name", () => {
    expect(createBranchInputSchema.safeParse({ name: "", addressLine: "124 Main St" }).success).toBe(false);
  });
});
