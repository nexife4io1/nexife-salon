import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, type SessionPayload } from "@/server/shared/session-token";

const secret = "x".repeat(40);
const payload = (overrides: Partial<SessionPayload> = {}): SessionPayload => ({
  sub: "user-1",
  tid: "tenant-1",
  role: "owner",
  name: "Sarah Jenkins",
  menus: [],
  exp: Math.floor(Date.now() / 1000) + 60,
  ...overrides,
});

describe("session token", () => {
  it("round-trips a valid payload", () => {
    const token = encodeSession(payload(), secret);
    expect(decodeSession(token, secret)).toMatchObject({ sub: "user-1", role: "owner" });
  });

  it("rejects a tampered body", () => {
    const [, sig] = encodeSession(payload(), secret).split(".");
    const forged = Buffer.from(JSON.stringify(payload({ role: "platform_admin" }))).toString("base64url");
    expect(decodeSession(`${forged}.${sig}`, secret)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    expect(decodeSession(encodeSession(payload(), secret), "y".repeat(40))).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = encodeSession(payload({ exp: Math.floor(Date.now() / 1000) - 1 }), secret);
    expect(decodeSession(token, secret)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(decodeSession(undefined, secret)).toBeNull();
    expect(decodeSession("not-a-token", secret)).toBeNull();
  });
});
