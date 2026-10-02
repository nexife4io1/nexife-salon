"use client";

import { Icon } from "@/components/ui/icon";
import { useShell } from "./shell-context";

export function MobileNavToggle() {
  const { setNavOpen } = useShell();
  return (
    <button
      type="button"
      onClick={() => setNavOpen(true)}
      className="-ml-2 rounded-full p-2 text-on-surface-variant hover:text-primary lg:hidden"
      aria-label="Open navigation"
    >
      <Icon name="menu" />
    </button>
  );
}
