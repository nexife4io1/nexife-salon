import { AppShell } from "@/components/layout/app-shell";
import { logoutAction } from "@/server/auth/actions";
import { getShellContext } from "@/server/auth/queries";

/** Authenticated area: every route in (app)/ renders inside the shared shell. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tenantName, allowedMenus } = await getShellContext();
  return (
    <AppShell user={user} tenantName={tenantName} allowedMenus={allowedMenus} signOutAction={logoutAction}>
      {children}
    </AppShell>
  );
}
