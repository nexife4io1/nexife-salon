import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/server/shared/session-token";

/**
 * Optimistic auth check (cookie signature + expiry only, no DB). Real
 * authorization happens close to the data in server/<domain>/queries|actions.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes (they authenticate themselves), static assets and metadata files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
