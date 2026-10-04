import { Suspense, type ReactNode } from "react";
import { GlobalNavigationLoader } from "./global-navigation-loader";
import { NavigationRuntimeBridge } from "./navigation-runtime-bridge";
import { ShellProvider } from "./shell-context";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** Authenticated application frame: fixed sidebar + glass top bar + fluid canvas. */
export function AppShell({
  children,
  user,
  tenantName,
  allowedMenus,
  signOutAction,
}: {
  children: ReactNode;
  user: { name: string; role: string };
  tenantName: string | null;
  allowedMenus: string[];
  signOutAction: () => Promise<void>;
}) {
  return (
    <ShellProvider>
      <NavigationRuntimeBridge />
      <GlobalNavigationLoader />
      <Sidebar allowed={allowedMenus} tenantName={tenantName} />
      <div className="flex min-h-screen flex-col lg:pl-sidebar">
        <Topbar userName={user.name} role={user.role} signOutAction={signOutAction} />
        <main className="flex-1 px-4 pt-[calc(var(--spacing-topbar)+2rem)] pb-page md:px-page">
          <div className="mx-auto w-full max-w-content">
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </main>
      </div>
    </ShellProvider>
  );
}
