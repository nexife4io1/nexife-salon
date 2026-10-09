import type { ActionResult } from "@/server/shared/result";

/** Banner for failures that aren't tied to a single field (field errors render inline). */
export function FormError({ state }: { state: ActionResult | undefined }) {
  if (!state || state.ok || state.error.code === "VALIDATION") return null;
  return (
    <p role="alert" className="rounded-control bg-error-container/60 px-4 py-3 text-body-sm text-on-error-container">
      {state.error.message}
    </p>
  );
}

export function fieldErrorsOf(state: ActionResult | undefined): Record<string, string[]> | undefined {
  return state && !state.ok ? state.error.fieldErrors : undefined;
}
