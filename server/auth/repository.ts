import "server-only";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { users } from "@/db/schema";
import { demoPassword, fixtureUsers } from "@/db/seed/fixtures";
import { hashPassword } from "@/lib/password";
import type { UserRecord } from "./schema";

// Fixture mode hashes the demo password once per process so the same
// verifyPassword() path is exercised in both modes.
let demoHash: Promise<string> | undefined;

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  if (isDatabaseConfigured()) {
    const [row] = await getDb().select().from(users).where(eq(users.username, username)).limit(1);
    return row ?? null;
  }
  // Demo login is a local-development convenience only.
  if (process.env.NODE_ENV === "production") return null;
  const fixture = fixtureUsers.find((u) => u.username === username);
  if (!fixture) return null;
  demoHash ??= hashPassword(demoPassword());
  return { ...fixture, passwordHash: await demoHash, menus: [] };
}

/** Demo accounts to hint on the login screen — only in local fixture mode. */
export function getDemoLoginHints(): { users: Array<{ username: string; name: string; role: string }>; password: string } | null {
  if (isDatabaseConfigured() || process.env.NODE_ENV === "production") return null;
  return { users: fixtureUsers.map(({ username, name, role }) => ({ username, name, role })), password: demoPassword() };
}
