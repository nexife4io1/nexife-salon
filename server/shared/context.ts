import "server-only";
import { redirect } from "next/navigation";
import { canAccess, homePathFor, type MenuKey } from "./rbac";
import { getSession, type Session } from "./session";
import type { Role } from "./session-token";

/**
 * Request context for tenant-scoped backend work. Every queries.ts / actions.ts
 * entry point starts here so authn + RBAC + tenant scoping live in one place.
 */
export type TenantContext = {
  tenantId: string;
  userId: string;
  role: Role;
  session: Session;
};

/** For Server Component reads: redirects instead of throwing. */
export async function requireTenantContext(menu: MenuKey): Promise<TenantContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.tid || !canAccess(session, menu)) redirect(homePathFor(session));
  return { tenantId: session.tid, userId: session.sub, role: session.role, session };
}

/** For Server Actions: returns null so the action can respond with an ActionResult. */
export async function getTenantContext(menu: MenuKey): Promise<TenantContext | null> {
  const session = await getSession();
  if (!session?.tid || !canAccess(session, menu)) return null;
  return { tenantId: session.tid, userId: session.sub, role: session.role, session };
}

export async function requirePlatformAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "platform_admin") redirect(homePathFor(session));
  return session;
}

/** For Server Actions: the session if it belongs to a platform admin, otherwise null (no redirect). */
export async function getPlatformAdmin(): Promise<Session | null> {
  const session = await getSession();
  return session?.role === "platform_admin" ? session : null;
}
