"use client";

import { create, type StoreApi, type UseBoundStore } from "zustand";

const API_CACHE_LIMIT = 60;

type CachedApiResponse = {
  cacheKey: string;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
  storedAt: number;
};

export type NavigationProgressState = {
  isNavigating: boolean;
  targetRoute: string | null;
  pendingApiRequests: number;
  apiCache: Record<string, CachedApiResponse>;
  startNavigation: (route: string) => void;
  completeNavigation: () => void;
  beginApiRequest: () => void;
  endApiRequest: () => void;
  cacheApiResponse: (entry: CachedApiResponse) => void;
  readApiResponse: (cacheKey: string, maxAgeMs: number) => CachedApiResponse | null;
  clearApiCache: () => void;
};

export const useNavigationProgress: UseBoundStore<StoreApi<NavigationProgressState>> = create<NavigationProgressState>()((set, get) => ({
  isNavigating: false,
  targetRoute: null,
  pendingApiRequests: 0,
  apiCache: {},
  startNavigation: (route) =>
    set((state) => ({
      isNavigating: true,
      targetRoute: route || state.targetRoute,
    })),
  completeNavigation: () => set({ isNavigating: false, targetRoute: null }),
  beginApiRequest: () => set((state) => ({ pendingApiRequests: state.pendingApiRequests + 1 })),
  endApiRequest: () =>
    set((state) => ({
      pendingApiRequests: Math.max(0, state.pendingApiRequests - 1),
    })),
  cacheApiResponse: (entry) =>
    set((state) => {
      const nextCache = { ...state.apiCache, [entry.cacheKey]: entry };
      const keys = Object.keys(nextCache);

      if (keys.length > API_CACHE_LIMIT) {
        keys
          .sort((a, b) => nextCache[a]!.storedAt - nextCache[b]!.storedAt)
          .slice(0, keys.length - API_CACHE_LIMIT)
          .forEach((key) => {
            delete nextCache[key];
          });
      }

      return { apiCache: nextCache };
    }),
  readApiResponse: (cacheKey, maxAgeMs): CachedApiResponse | null => {
    const entry: CachedApiResponse | undefined = get().apiCache[cacheKey];
    if (!entry) return null;
    if (Date.now() - entry.storedAt > maxAgeMs) return null;
    return entry;
  },
  clearApiCache: () => set({ apiCache: {} }),
}));

export type { CachedApiResponse };
