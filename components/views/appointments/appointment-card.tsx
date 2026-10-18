import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_TYPE_LABELS, type Appointment, type AppointmentStatus } from "@/server/appointments/schema";
import { AppointmentActions } from "./appointment-actions";
import { formatClock } from "./format";

const TONE: Record<AppointmentStatus, BadgeTone> = {
  booked: "neutral",
  checked_in: "warning",
  in_service: "gold",
  completed: "success",
  cancelled: "error",
  no_show: "error",
};

const ACCENT: Record<AppointmentStatus, string> = {
  booked: "border-l-outline-variant",
  checked_in: "border-l-primary-container",
  in_service: "border-l-primary",
  completed: "border-l-on-success-container/60",
  cancelled: "border-l-error/50",
  no_show: "border-l-error/50",
};

/** What the card needs to offer checkout: whether the viewer may bill, and the receipt if already paid. */
export type CardBilling = { canCheckout: boolean; receiptId?: string };

export function AppointmentCard({
  appointment: a,
  timezone,
  currency,
  branchName,
  billing,
  readOnly,
}: {
  appointment: Appointment;
  timezone: string;
  currency: string;
  /** Shown when the board spans several branches. */
  branchName?: string;
  billing?: CardBilling;
  readOnly: boolean;
}) {
  const closed = a.status === "cancelled" || a.status === "no_show";
  const who = a.customerName ?? "walk-in";
  return (
    <article
      className={cn(
        "rounded-card border border-l-4 border-outline-variant/15 bg-surface-container-lowest p-4 shadow-card transition-shadow hover:shadow-raised",
        ACCENT[a.status],
        closed && "opacity-75",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-label-md text-secondary">
          <time dateTime={a.startsAt.toISOString()}>{formatClock(a.startsAt, timezone)}</time> – <time dateTime={a.endsAt.toISOString()}>{formatClock(a.endsAt, timezone)}</time>
        </p>
        <Badge tone={TONE[a.status]} dot>
          {APPOINTMENT_STATUS_LABELS[a.status]}
        </Badge>
      </div>
      <h4 className={cn("font-headline text-body-md font-semibold text-on-surface", closed && "line-through decoration-outline/60")}>{a.customerName ?? "Walk-in"}</h4>
      {a.services.length ? (
        <ul className="text-body-sm text-secondary">
          {a.services.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span>
                {line.name} · {line.durationMinutes} min
              </span>
              <span>{formatMoney(line.priceCents, currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-secondary">Service removed · {a.durationMinutes} min</p>
      )}
      <p className="mt-1 flex flex-wrap gap-x-2 text-label-sm text-secondary">
        {a.type === "walk_in" && <span>{APPOINTMENT_TYPE_LABELS.walk_in}</span>}
        {branchName && <span>{branchName}</span>}
      </p>
      {a.notes && <p className="mt-2 line-clamp-2 text-label-sm text-on-surface-variant">{a.notes}</p>}
      {a.status === "completed" && a.services.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-outline-variant/15 pt-3">
          <span className="text-label-md text-on-surface">
            {formatMoney(a.totalCents, currency)}{" "}
            <Badge tone={billing?.receiptId ? "success" : "warning"} className="ml-1">
              {billing?.receiptId ? "Paid" : "Unpaid"}
            </Badge>
          </span>
          {billing?.receiptId ? (
            <ButtonLink href={`/billing/receipts/${billing.receiptId}`} variant="secondary" size="sm" icon="receipt">
              Receipt
            </ButtonLink>
          ) : billing?.canCheckout && !readOnly ? (
            <ButtonLink href={`/billing/checkout/${a.id}`} variant="accent" size="sm" icon="banknote">
              Checkout
            </ButtonLink>
          ) : null}
        </div>
      )}
      {!readOnly && <AppointmentActions id={a.id} status={a.status} who={who} checkoutHref={billing?.canCheckout && !billing.receiptId ? `/billing/checkout/${a.id}` : undefined} />}
    </article>
  );
}
