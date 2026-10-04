"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-config";
import { MOBILE_NAV_PANEL_ID, MOBILE_NAV_TOGGLE_ID, useShell } from "./shell-context";

/**
 * Fixed left navigation (mockup SideNavBar): brand, quiet links, gold active
 * rail, champagne "AI Style Studio" feature button. Becomes a drawer < lg.
 */
export function Sidebar({ allowed, tenantName }: { allowed: string[]; tenantName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { navOpen, setNavOpen } = useShell();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const items = NAV_ITEMS.filter((item) => allowed.includes(item.key));

  const close = useCallback(() => {
    setNavOpen(false);
  }, [setNavOpen]);

  const handleNavigationClick = useCallback(
    (_href: string) => {
      close();
    },
    [close],
  );

  const prefetchRoute = useCallback(
    (href: string) => {
      void router.prefetch(href);
    },
    [router],
  );

  useEffect(() => {
    const prefetchAll = () => {
      for (const item of items) prefetchRoute(item.href);
    };

    const globalTimers = globalThis as typeof globalThis & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof globalTimers.requestIdleCallback === "function") {
      const idleId = globalTimers.requestIdleCallback(prefetchAll);
      return () => globalTimers.cancelIdleCallback?.(idleId);
    }

    const timeoutId = globalThis.setTimeout(prefetchAll, 250);
    return () => globalThis.clearTimeout(timeoutId);
  }, [items, prefetchRoute]);

  useEffect(() => {
    if (!navOpen) return;

    const panel = panelRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const focusable = panel?.querySelectorAll<HTMLElement>(focusableSelector);
    (focusable?.[0] ?? closeButtonRef.current)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const nodes = panel.querySelectorAll<HTMLElement>(focusableSelector);
      if (nodes.length === 0) return;

      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);

      if (window.matchMedia("(max-width: 1023px)").matches) {
        (document.getElementById(MOBILE_NAV_TOGGLE_ID) as HTMLButtonElement | null)?.focus();
      }
    };
  }, [close, navOpen]);

  return (
    <>
      <button
        type="button"
        className={cn(
          "fixed inset-0 z-40 bg-inverse-surface/30 backdrop-blur-sm transition-opacity lg:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={close}
        aria-label="Close navigation"
        aria-hidden={!navOpen}
        tabIndex={navOpen ? 0 : -1}
      />
      <nav
        id={MOBILE_NAV_PANEL_ID}
        ref={panelRef}
        aria-label="Primary"
        role={navOpen ? "dialog" : undefined}
        aria-modal={navOpen ? true : undefined}
        aria-labelledby={navOpen ? "primary-navigation-title" : undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-sidebar flex-col border-r border-outline-variant/15 bg-surface shadow-sm transition-transform duration-300 lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between px-6 pt-7 pb-6">
          <Link href="/" className="block" onClick={() => handleNavigationClick("/")}>
            <span id="primary-navigation-title" className="font-headline text-headline-md font-bold text-primary">
              Nexife
            </span>
            <span className="mt-1 block text-label-md text-secondary">{tenantName ?? "Premium Salon Management"}</span>
          </Link>
          <button
            ref={closeButtonRef}
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
                    onClick={() => handleNavigationClick(item.href)}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    onFocus={() => prefetchRoute(item.href)}
                    prefetch
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
                  onClick={() => handleNavigationClick(item.href)}
                  onMouseEnter={() => prefetchRoute(item.href)}
                  onFocus={() => prefetchRoute(item.href)}
                  prefetch
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
