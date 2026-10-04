"use client";

import { Icon } from "@/components/ui/icon";
import { MOBILE_NAV_PANEL_ID, MOBILE_NAV_TOGGLE_ID, useShell } from "./shell-context";

export function MobileNavToggle() {
  const { navOpen, setNavOpen } = useShell();
  return (
    <button
      id={MOBILE_NAV_TOGGLE_ID}
      type="button"
      onClick={() => setNavOpen(true)}
      className="-ml-2 rounded-full p-2 text-on-surface-variant hover:text-primary lg:hidden"
      aria-label="Open navigation"
      aria-controls={MOBILE_NAV_PANEL_ID}
      aria-expanded={navOpen}
    >
      <Icon name="menu" />
    </button>
  );
}
