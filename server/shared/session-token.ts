import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * HMAC-SHA256 signed session token: `<base64url(json)>.<base64url(sig)>`.
 *
 * Kept from the POC's session philosophy: a stateless signed cookie, no
 * session table. Pure functions (no Next.js APIs) so they run in proxy.ts,
 * server code and unit tests alike.
 */

export const ROLES = ["platform_admin", "owner", "manager", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const sessionPayloadSchema = z.object({
  sub: z.string().min(1), // user id
  tid: z.string().nullable(), // tenant id (null for platform admins)
  role: z.enum(ROLES),
  name: z.string(),
  menus: z.array(z.string()).default([]),
  exp: z.number().int(), // unix seconds
});
export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

export const SESSION_COOKIE = "nexife_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

const DEV_FALLBACK_SECRET = "nexife-dev-only-secret-change-me-0123456789";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set (>= 32 chars) in production.");
  }
  return DEV_FALLBACK_SECRET;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function encodeSession(payload: SessionPayload, secret = getSessionSecret()): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** Returns the payload if the signature is valid and the token is unexpired, else null. */
export function decodeSession(token: string | undefined, secret = getSessionSecret(), now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const parsed = sessionPayloadSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    if (!parsed.success || parsed.data.exp * 1000 <= now) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
