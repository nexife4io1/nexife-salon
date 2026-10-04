"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export const MOBILE_NAV_PANEL_ID = "primary-navigation-panel";
export const MOBILE_NAV_TOGGLE_ID = "primary-navigation-toggle";

/** UI-only shell state (mobile nav drawer). No domain data lives in client context. */
type ShellState = { navOpen: boolean; setNavOpen: (open: boolean) => void };

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  return <ShellContext.Provider value={{ navOpen, setNavOpen }}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}
