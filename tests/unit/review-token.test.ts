import { describe, expect, it } from "vitest";
import { newReviewNonce, signReviewToken, verifyReviewToken } from "@/server/appointments/review-token";

const SECRET = "unit-test-secret-unit-test-secret-0123";
const TENANT = "7d3c9f62-1d0a-4e1b-9a55-2b6f0c1e0a01";

describe("review token", () => {
  it("round-trips the tenant and nonce", () => {
    const nonce = newReviewNonce();
    expect(verifyReviewToken(signReviewToken(TENANT, nonce, SECRET), SECRET)).toEqual({ tenantId: TENANT, nonce });
  });

  it("is unpredictable: nonces are random, 128 bits, and URL-safe", () => {
    const nonces = new Set(Array.from({ length: 200 }, newReviewNonce));
    expect(nonces.size).toBe(200);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("is URL-safe, short enough for a QR code, and carries no readable ids", () => {
    const token = signReviewToken(TENANT, newReviewNonce(), SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(token.length).toBeLessThan(100);
    expect(token).not.toContain(TENANT);
  });

  it("rejects a token signed with another secret, or with any part altered", () => {
    const token = signReviewToken(TENANT, newReviewNonce(), SECRET);
    expect(verifyReviewToken(token, "a-different-secret-a-different-secret-1")).toBeNull();
    const [payload, tag] = token.split(".") as [string, string];
    const flip = (s: string) => s.slice(0, -1) + (s.endsWith("A") ? "B" : "A");
    expect(verifyReviewToken(`${flip(payload)}.${tag}`, SECRET)).toBeNull();
    expect(verifyReviewToken(`${payload}.${flip(tag)}`, SECRET)).toBeNull();
    expect(verifyReviewToken(`${tag}.${payload}`, SECRET)).toBeNull();
  });

  it("rejects the wrong shape without throwing", () => {
    for (const bad of ["", ".", "a", "a.b", "a.b.c", "x".repeat(500), "%00.%00", "💥.💥", `${"A".repeat(43)}.${"A".repeat(22)}`]) {
      expect(verifyReviewToken(bad, SECRET), bad).toBeNull();
    }
    expect(verifyReviewToken(undefined as unknown as string, SECRET)).toBeNull();
    expect(verifyReviewToken(42 as unknown as string, SECRET)).toBeNull();
  });

  it("does not let one tenant's tag vouch for another tenant's id", () => {
    const nonce = newReviewNonce();
    const mine = signReviewToken(TENANT, nonce, SECRET);
    const theirs = signReviewToken("11111111-1111-4111-8111-111111111111", nonce, SECRET);
    const forged = `${theirs.split(".")[0]}.${mine.split(".")[1]}`;
    expect(verifyReviewToken(forged, SECRET)).toBeNull();
  });
});
