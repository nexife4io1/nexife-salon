"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-config";
import { useShell } from "./shell-context";

/**
 * Fixed left navigation (mockup SideNavBar): brand, quiet links, gold active
 * rail, champagne "AI Style Studio" feature button. Becomes a drawer < lg.
 */
export function Sidebar({ allowed, tenantName }: { allowed: string[]; tenantName: string | null }) {
  const pathname = usePathname();
  const { navOpen, setNavOpen } = useShell();
  const items = NAV_ITEMS.filter((item) => allowed.includes(item.key));

  const close = () => setNavOpen(false);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-inverse-surface/30 backdrop-blur-sm transition-opacity lg:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={close}
        aria-hidden
      />
      <nav
        aria-label="Primary"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-sidebar flex-col border-r border-outline-variant/15 bg-surface shadow-sm transition-transform duration-300 lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between px-6 pt-7 pb-6">
          <Link href="/" className="block">
            <span className="font-headline text-headline-md font-bold text-primary">Nexife</span>
            <span className="mt-1 block text-label-md text-secondary">{tenantName ?? "Premium Salon Management"}</span>
          </Link>
          <button
            type="button"
            className="-mr-2 rounded-full p-2 text-secondary hover:text-primary lg:hidden"
            onClick={close}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>

        <ul className="flex-1 space-y-1 overflow-y-auto py-2">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            if (item.kind === "feature") {
              return (
                <li key={item.key} className="px-4 py-2">
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-control bg-primary-container px-4 py-3 text-label-md text-on-primary-container transition-all hover:opacity-90",
                      active && "ring-2 ring-primary/40 ring-offset-2 ring-offset-surface",
                    )}
                  >
                    <Icon name={item.icon} size={18} />
                    {item.label}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 border-l-4 px-4 py-3 text-label-md transition-colors",
                    active
                      ? "border-primary bg-surface-container-low font-bold text-primary"
                      : "border-transparent text-secondary hover:bg-surface-container-high hover:text-on-surface",
                  )}
                >
                  <Icon name={item.icon} strokeWidth={active ? 2 : 1.5} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-6 py-5 text-label-sm text-secondary/70">Nexife Salon · v0.1</p>
      </nav>
    </>
  );
}
