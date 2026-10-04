import type { z } from "zod";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "NOT_IMPLEMENTED"
  | "DB_NOT_CONFIGURED"
  | "INTERNAL";

/** Typed domain error. Services throw these; actions convert them to ActionResult. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function validationError(error: z.ZodError): AppError {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return new AppError("VALIDATION", "Please fix the highlighted fields.", fieldErrors);
}

export function notImplemented(feature: string): AppError {
  return new AppError("NOT_IMPLEMENTED", `${feature} is not implemented yet.`);
}
