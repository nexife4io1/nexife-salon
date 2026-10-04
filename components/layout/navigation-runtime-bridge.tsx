"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type CachedApiResponse, type NavigationProgressState, useNavigationProgress } from "./navigation-progress-store";

const CACHE_MAX_AGE_MS = 45_000;

function toRouteKey(pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function isSameOriginAppLink(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const nextUrl = new URL(anchor.href, globalThis.location.href);
  if (nextUrl.origin !== globalThis.location.origin) return false;
  if (nextUrl.pathname.startsWith("/api/")) return false;
  return true;
}

function cacheKeyForRequest(request: Request) {
  const url = new URL(request.url, globalThis.location.href);
  return `${request.method.toUpperCase()}:${url.pathname}${url.search}`;
}

function responseFromCache(entry: CachedApiResponse): Response {
  return new Response(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers: new Headers(entry.headers),
  });
}

async function cacheResponse(cacheKey: string, response: Response) {
  const cloned = response.clone();
  const body = await cloned.text();

  useNavigationProgress.getState().cacheApiResponse({
    cacheKey,
    status: cloned.status,
    statusText: cloned.statusText,
    headers: Array.from(cloned.headers.entries()),
    body,
    storedAt: Date.now(),
  });
}

async function refreshCacheInBackground(request: Request, originalFetch: typeof globalThis.fetch, cacheKey: string) {
  try {
    const response = await originalFetch(request);
    if (response.ok) await cacheResponse(cacheKey, response);
  } catch {
    // Ignore background refresh errors; stale data will age out.
  }
}

export function NavigationRuntimeBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeKey = toRouteKey(pathname, searchParams);
  const startNavigation = useNavigationProgress((state: NavigationProgressState) => state.startNavigation);
  const completeNavigation = useNavigationProgress((state: NavigationProgressState) => state.completeNavigation);
  const isNavigating = useNavigationProgress((state: NavigationProgressState) => state.isNavigating);

  useEffect(() => {
    const prefetchedRoutes = new Set<string>();

    const prefetchAnchorRoute = (anchor: HTMLAnchorElement) => {
      if (!isSameOriginAppLink(anchor)) return;
      const url = new URL(anchor.href, globalThis.location.href);
      const route = `${url.pathname}${url.search}`;
      if (prefetchedRoutes.has(route)) return;

      prefetchedRoutes.add(route);
      void router.prefetch(route);
    };

    const handleClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isSameOriginAppLink(anchor)) return;

      const url = new URL(anchor.href, globalThis.location.href);
      const nextRoute = `${url.pathname}${url.search}`;
      const currentRoute = `${globalThis.location.pathname}${globalThis.location.search}`;
      if (nextRoute === currentRoute) return;

      void router.prefetch(nextRoute);
      startNavigation(nextRoute);
    };

    const handleHoverPrefetch = (event: MouseEvent | FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      prefetchAnchorRoute(anchor);
    };

    globalThis.document.addEventListener("click", handleClickCapture, true);
    globalThis.document.addEventListener("mouseover", handleHoverPrefetch, true);
    globalThis.document.addEventListener("focusin", handleHoverPrefetch, true);

    return () => {
      globalThis.document.removeEventListener("click", handleClickCapture, true);
      globalThis.document.removeEventListener("mouseover", handleHoverPrefetch, true);
      globalThis.document.removeEventListener("focusin", handleHoverPrefetch, true);
    };
  }, [router, startNavigation]);

  useEffect(() => {
    const onPopState = () => {
      startNavigation(`${globalThis.location.pathname}${globalThis.location.search}`);
    };

    globalThis.addEventListener("popstate", onPopState);
    return () => {
      globalThis.removeEventListener("popstate", onPopState);
    };
  }, [startNavigation]);

  useEffect(() => {
    const settleTimer = globalThis.setTimeout(() => {
      completeNavigation();
    }, 120);

    return () => globalThis.clearTimeout(settleTimer);
  }, [completeNavigation, routeKey]);

  useEffect(() => {
    if (!isNavigating) return;

    const safetyTimer = globalThis.setTimeout(() => {
      completeNavigation();
    }, 10_000);

    return () => globalThis.clearTimeout(safetyTimer);
  }, [completeNavigation, isNavigating]);

  useEffect(() => {
    const originalFetch = globalThis.fetch.bind(globalThis);

    const patchedFetch: typeof globalThis.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const method = request.method.toUpperCase();
      const url = new URL(request.url, globalThis.location.href);
      const isApiRequest = url.origin === globalThis.location.origin && url.pathname.startsWith("/api/");

      if (!isApiRequest) return originalFetch(input, init);

      const cacheKey = cacheKeyForRequest(request);
      if (method === "GET") {
        const cached = useNavigationProgress.getState().readApiResponse(cacheKey, CACHE_MAX_AGE_MS);
        if (cached) {
          void refreshCacheInBackground(request, originalFetch, cacheKey);
          return responseFromCache(cached);
        }
      }

      const store = useNavigationProgress.getState();
      store.beginApiRequest();

      try {
        const response = await originalFetch(input, init);
        if (method === "GET" && response.ok) await cacheResponse(cacheKey, response);
        return response;
      } finally {
        useNavigationProgress.getState().endApiRequest();
      }
    };

    globalThis.fetch = patchedFetch;
    return () => {
      globalThis.fetch = originalFetch;
    };
  }, []);

  return null;
}
