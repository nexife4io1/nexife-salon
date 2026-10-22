"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/shared/result";

export type AttendanceFormAction = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  submitText,
  className,
}: {
  action: AttendanceFormAction;
  children: ReactNode;
  submitText: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : submitText}
      </Button>
      {state && !state.ok && (
        <div role="alert" className="text-label-sm text-error">
          <p>{state.error.message}</p>
          {state.error.fieldErrors && (
            <ul className="mt-1 list-inside list-disc">
              {Object.values(state.error.fieldErrors).flat().map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
            </ul>
          )}
        </div>
      )}
      {state?.ok && <p role="status" className="text-label-sm text-success">Saved.</p>}
    </form>
  );
}
