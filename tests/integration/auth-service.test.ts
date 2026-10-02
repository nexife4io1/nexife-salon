import { beforeAll, describe, expect, it, vi } from "vitest";

// Fixture-mode login: same verifyPassword() path as database mode.
beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("DEMO_PASSWORD", "test-pass");
});

describe("auth service (fixture mode)", () => {
  it("authenticates a demo user without exposing the hash", async () => {
    const { authenticate } = await import("@/server/auth/service");
    const user = await authenticate({ username: "Sarah", password: "test-pass" });
    expect(user).toMatchObject({ username: "sarah", role: "owner" });
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("rejects a wrong password and unknown users", async () => {
    const { authenticate } = await import("@/server/auth/service");
    expect(await authenticate({ username: "sarah", password: "wrong" })).toBeNull();
    expect(await authenticate({ username: "nobody", password: "test-pass" })).toBeNull();
  });
});
