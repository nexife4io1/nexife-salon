import "server-only";
import { verifyPassword } from "@/lib/password";
import type { LoginInput, UserRecord } from "./schema";
import { findUserByUsername, getDemoLoginHints } from "./repository";

// Verified against when the user doesn't exist so response time doesn't reveal valid usernames.
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

export async function authenticate(input: LoginInput): Promise<Omit<UserRecord, "passwordHash"> | null> {
  const user = await findUserByUsername(input.username.toLowerCase());
  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return null;
  return { id: user.id, tenantId: user.tenantId, name: user.name, username: user.username, role: user.role, menus: user.menus };
}

export function getLoginHints() {
  return getDemoLoginHints();
}
