"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { changeAppointmentStatusAction, deleteAppointmentAction } from "@/server/appointments/actions";
import { APPOINTMENT_STATUS_LABELS, STATUS_TRANSITIONS, type AppointmentStatus, type AppointmentType } from "@/server/appointments/schema";

const PRIMARY: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string }>> = {
  booked: { to: "checked_in", label: "Check in" },
  checked_in: { to: "in_service", label: "Start service" },
  in_service: { to: "completed", label: "Complete" },
};

const SECONDARY: Partial<Record<AppointmentStatus, string>> = { no_show: "No-show", cancelled: "Cancel" };

/**
 * The next legal status moves for one appointment, plus Edit (bookings not yet checked in) and Delete.
 * Walk-ins only get Cancel and Delete; No-show appears once the scheduled start has passed (`canNoShow`, decided on
 * the server). Failures (stale screen, rules) render in place.
 * With `checkoutHref`, completing the service opens checkout; completing never records a payment.
 */
export function AppointmentActions({
  id,
  status,
  type,
  who,
  canNoShow,
  canEdit,
  canManageServices,
  checkoutHref,
}: {
  id: string;
  status: AppointmentStatus;
  type: AppointmentType;
  who: string;
  canNoShow: boolean;
  canEdit: boolean;
  /** Checked in, in service or completed: the Services screen has something to do. */
  canManageServices: boolean;
  checkoutHref?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(changeAppointmentStatusAction, undefined);
  const [deleteState, deleteAction, deleting] = useActionState(deleteAppointmentAction, undefined);
  const requested = useRef<string | null>(null);
  useEffect(() => {
    if (state?.ok && requested.current === "completed" && checkoutHref) router.push(checkoutHref);
  }, [state, checkoutHref, router]);
  const primary = PRIMARY[status];
  const secondary = STATUS_TRANSITIONS[status].filter((to) => to in SECONDARY && to !== primary?.to && (to !== "no_show" || (type === "booking" && canNoShow)));
  const busy = pending || deleting;
  const error = (state && !state.ok ? state : deleteState && !deleteState.ok ? deleteState : undefined)?.error.message;

  return (
    <form action={formAction} className="mt-4 border-t border-outline-variant/15 pt-3" aria-busy={busy}>
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {canEdit && (
            <ButtonLink href={`/appointments/${id}/edit`} variant="ghost" size="sm" className="px-2">
              Edit
            </ButtonLink>
          )}
          {canManageServices && (
            <ButtonLink href={`/appointments/${id}/services`} variant="ghost" size="sm" className="px-2">
              Services
            </ButtonLink>
          )}
          {secondary.map((to) => (
            <Button
              key={to}
              type="submit"
              name="status"
              value={to}
              variant="ghost"
              size="sm"
              className="px-2"
              disabled={busy}
              onClick={(event) => {
                if (!window.confirm(`Mark ${who}'s appointment as ${APPOINTMENT_STATUS_LABELS[to].toLowerCase()}?`)) event.preventDefault();
              }}
            >
              {SECONDARY[to]}
            </Button>
          ))}
          <Button
            type="submit"
            formAction={deleteAction}
            variant="ghost"
            size="sm"
            className="px-2 text-error"
            disabled={busy}
            onClick={(event) => {
              if (!window.confirm(`Permanently delete ${who}'s appointment? This can't be undone. Receipts already issued are kept.`)) event.preventDefault();
            }}
          >
            Delete
          </Button>
        </div>
        {primary && (
          <Button type="submit" name="status" value={primary.to} variant="accent" size="sm" disabled={busy} onClick={() => (requested.current = primary.to)}>
            {primary.label}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-label-sm text-error">
          {error}
        </p>
      )}
    </form>
  );
}
