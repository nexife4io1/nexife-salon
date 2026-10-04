"use client";

import { NavigationLoader } from "./navigation-loader";
import { type NavigationProgressState, useNavigationProgress } from "./navigation-progress-store";

export function GlobalNavigationLoader() {
  const isNavigating = useNavigationProgress((state: NavigationProgressState) => state.isNavigating);
  const pendingApiRequests = useNavigationProgress((state: NavigationProgressState) => state.pendingApiRequests);

  const visible = isNavigating || pendingApiRequests > 0;
  if (!visible) return null;

  const label = isNavigating
    ? "Styling your next screen..."
    : pendingApiRequests > 1
      ? "Applying salon updates..."
      : "Applying salon update...";

  return <NavigationLoader variant="overlay" label={label} />;
}
