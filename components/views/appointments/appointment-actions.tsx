"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { changeAppointmentStatusAction } from "@/server/appointments/actions";
import { APPOINTMENT_STATUS_LABELS, STATUS_TRANSITIONS, type AppointmentStatus } from "@/server/appointments/schema";

const PRIMARY: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string }>> = {
  booked: { to: "checked_in", label: "Check in" },
  checked_in: { to: "in_service", label: "Start service" },
  in_service: { to: "completed", label: "Complete" },
};

const SECONDARY: Partial<Record<AppointmentStatus, string>> = { no_show: "No-show", cancelled: "Cancel" };

/**
 * The next legal status moves for one appointment. Failures (stale screen, rules) render in place.
 * With `checkoutHref`, completing the service opens checkout; completing never records a payment.
 */
export function AppointmentActions({ id, status, who, checkoutHref }: { id: string; status: AppointmentStatus; who: string; checkoutHref?: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(changeAppointmentStatusAction, undefined);
  const requested = useRef<string | null>(null);
  useEffect(() => {
    if (state?.ok && requested.current === "completed" && checkoutHref) router.push(checkoutHref);
  }, [state, checkoutHref, router]);
  const primary = PRIMARY[status];
  const secondary = STATUS_TRANSITIONS[status].filter((to) => to in SECONDARY && to !== primary?.to);
  if (!primary && !secondary.length) return null;

  return (
    <form action={formAction} className="mt-4 border-t border-outline-variant/15 pt-3" aria-busy={pending}>
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {secondary.map((to) => (
            <Button
              key={to}
              type="submit"
              name="status"
              value={to}
              variant="ghost"
              size="sm"
              className="px-2"
              disabled={pending}
              onClick={(event) => {
                if (!window.confirm(`Mark ${who}'s appointment as ${APPOINTMENT_STATUS_LABELS[to].toLowerCase()}?`)) event.preventDefault();
              }}
            >
              {SECONDARY[to]}
            </Button>
          ))}
        </div>
        {primary && (
          <Button type="submit" name="status" value={primary.to} variant="accent" size="sm" disabled={pending} onClick={() => (requested.current = primary.to)}>
            {primary.label}
          </Button>
        )}
      </div>
      {state && !state.ok && (
        <p role="alert" className="mt-2 text-label-sm text-error">
          {state.error.message}
        </p>
      )}
    </form>
  );
}
