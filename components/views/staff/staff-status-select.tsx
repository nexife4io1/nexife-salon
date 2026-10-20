"use client";

import { useActionState, useRef } from "react";
import { setStaffStatusAction } from "@/server/staff/actions";
import { STAFF_STATUSES, STAFF_STATUS_LABELS, type StaffStatus } from "@/server/staff/schema";

/** Inline status control for a directory row: persists immediately and reports failures in place. */
export function StaffStatusSelect({ staffId, name, status, disabled }: { staffId: string; name: string; status: StaffStatus; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(setStaffStatusAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  const selectId = `status-${staffId}`;

  return (
    <form ref={form} action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={staffId} />
      <label htmlFor={selectId} className="sr-only">
        Status for {name}
      </label>
      <select
        id={selectId}
        name="status"
        defaultValue={status}
        disabled={disabled || pending}
        onChange={() => form.current?.requestSubmit()}
        className="h-8 rounded-control border border-outline-variant/40 bg-transparent px-2 text-label-md text-on-surface focus:border-primary-container focus:outline-none disabled:opacity-60"
      >
        {STAFF_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STAFF_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {state && !state.ok && (
        <span role="alert" className="max-w-48 text-right text-label-sm text-error">
          {state.error.message}
        </span>
      )}
    </form>
  );
}
