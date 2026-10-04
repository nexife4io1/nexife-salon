import { AppError, type AppErrorCode } from "./errors";

/**
 * Uniform return type for Server Actions so forms can render errors without
 * try/catch. Reads (queries.ts) throw instead and rely on error boundaries.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AppErrorCode; message: string; fieldErrors?: Record<string, string[]> } };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { ok: false, error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors } };
  }
  // Matched by name so the backend layer never imports db/ (only repositories may).
  if (error instanceof Error && error.name === "DatabaseNotConfiguredError") {
    return {
      ok: false,
      error: { code: "DB_NOT_CONFIGURED", message: "Saving needs a database. Set DATABASE_URL in .env.local (demo mode is read-only)." },
    };
  }
  console.error(error);
  return { ok: false, error: { code: "INTERNAL", message: "Something went wrong. Please try again." } };
}
