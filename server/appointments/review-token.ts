import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The public review link carries a signed token: `<base64url(tenant id bytes + nonce)>.<tag>`.
 *
 * - The nonce is 128 random bits, stored on the `review_requests` row; it is what the row is looked up by.
 * - The tag is a truncated HMAC-SHA256 over the payload, keyed by the server secret, so a token can only be minted
 *   by this server. It is checked in constant time before any database access, which means guessed or tampered
 *   links never reach the database and cannot be used to probe for tenants or appointments.
 * - The token holds no appointment id, customer or other internal id the page could be abused with; the tenant id
 *   is only there so the row can be read through the usual tenant-scoped (RLS) path.
 * - Nothing secret is stored: the link is re-derived from (tenant id, nonce), so a receipt can show it again.
 *
 * Pure functions (no Next.js APIs, no database), like `server/shared/session-token.ts`.
 */

const TAG_BYTES = 16;
const NONCE_BYTES = 16;
const DOMAIN = "nexife-review-link-v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tagFor = (payload: string, secret: string) => createHmac("sha256", secret).update(DOMAIN + payload).digest().subarray(0, TAG_BYTES).toString("base64url");

export function newReviewNonce(): string {
  return randomBytes(NONCE_BYTES).toString("base64url");
}

export function signReviewToken(tenantId: string, nonce: string, secret: string): string {
  const payload = Buffer.concat([Buffer.from(tenantId.replaceAll("-", ""), "hex"), Buffer.from(nonce, "base64url")]).toString("base64url");
  return `${payload}.${tagFor(payload, secret)}`;
}

/** The tenant and nonce a genuine token was minted for, or null for anything else (wrong shape, tampered, other secret). */
export function verifyReviewToken(token: string, secret: string): { tenantId: string; nonce: string } | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, tag] = parts as [string, string];
  const expected = Buffer.from(tagFor(payload, secret));
  const given = Buffer.from(tag);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const bytes = Buffer.from(payload, "base64url");
  if (bytes.length !== 16 + NONCE_BYTES) return null;
  const hex = bytes.subarray(0, 16).toString("hex");
  const tenantId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if (!UUID.test(tenantId)) return null;
  return { tenantId, nonce: bytes.subarray(16).toString("base64url") };
}
