import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  decodeSession,
  encodeSession,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type SessionPayload,
} from "./session-token";

/** Cookie-backed session access for Server Components, Server Actions and Route Handlers. */

export type Session = SessionPayload;

/** Memoized per request (React `cache`) so many queries can call it cheaply. */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
});

/** Call only from Server Actions / Route Handlers (cookies can't be set during render). */
export async function startSession(payload: Omit<Session, "exp">): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession({ ...payload, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
