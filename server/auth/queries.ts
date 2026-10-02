import "server-only";
import { redirect } from "next/navigation";
import { allowedMenus, homePathFor } from "@/server/shared/rbac";
import { getSession } from "@/server/shared/session";
import * as tenantsService from "@/server/tenants/service";
import * as authService from "./service";

/** Everything the authenticated app shell needs, in one call. Redirects to /login if signed out. */
export async function getShellContext() {
  const session = await getSession();
  if (!session) redirect("/login");
  const tenant = session.tid ? await tenantsService.getTenant(session.tid).catch(() => null) : null;
  return {
    user: { name: session.name, role: session.role },
    tenantName: tenant?.name ?? null,
    allowedMenus: allowedMenus(session),
  };
}

/** Where "/" should send the current visitor. */
export async function getHomePath(): Promise<string> {
  const session = await getSession();
  return session ? homePathFor(session) : "/login";
}

/** Local-dev convenience for the login screen (null in production / DB mode). */
export async function getLoginHints() {
  return authService.getLoginHints();
}
