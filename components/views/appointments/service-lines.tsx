"use client";

import { useActionState, useId, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { zonedDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import {
  addServiceLineAction,
  changeServiceLineStatusAction,
  reassignServiceLineAction,
  removeServiceLineAction,
} from "@/server/appointments/actions";
import {
  MAX_SERVICES_PER_APPOINTMENT,
  REASSIGN_REASON_MIN,
  SERVICE_LINE_STATUS_LABELS,
  type AppointmentServiceLine,
  type AppointmentServicesView,
  type ServiceLineEvent,
  type ServiceLineStatus,
} from "@/server/appointments/schema";
import { formatClock, formatDay } from "./format";

const TONE: Record<ServiceLineStatus, BadgeTone> = { pending: "neutral", in_progress: "gold", completed: "success" };

const EVENT_TEXT: Record<ServiceLineEvent["kind"], (e: ServiceLineEvent) => string> = {
  added: (e) => `${e.serviceName} added${e.toStaffName ? ` for ${e.toStaffName}` : ""}`,
  removed: (e) => `${e.serviceName} removed`,
  started: (e) => `${e.serviceName} started${e.toStaffName ? ` by ${e.toStaffName}` : ""}`,
  completed: (e) => `${e.serviceName} completed${e.toStaffName ? ` by ${e.toStaffName}` : ""}`,
  reassigned: (e) => `${e.serviceName} moved from ${e.fromStaffName ?? "nobody"} to ${e.toStaffName ?? "nobody"}`,
  corrected: (e) => `${e.serviceName} corrected after completion: ${e.fromStaffName ?? "nobody"} → ${e.toStaffName ?? "nobody"}`,
};

function ErrorLine({ id, message }: { id?: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="mt-2 text-label-sm text-error">
      {message}
    </p>
  ) : null;
}

type Team = AppointmentServicesView["team"];

/** Team members who may take this service: active at the branch and (if they declared any) qualified for it. */
function eligibleTeam(view: AppointmentServicesView, serviceId: string | null): Team {
  return view.team.filter((m) => !serviceId || !view.teamServices[m.id] || view.teamServices[m.id]!.includes(serviceId));
}

function LineRow({ line, view }: { line: AppointmentServiceLine; view: AppointmentServicesView }) {
  const appointmentId = view.appointment.id;
  const [statusState, statusAction, statusPending] = useActionState(changeServiceLineStatusAction, undefined);
  const [removeState, removeAction, removing] = useActionState(removeServiceLineAction, undefined);
  const [reassignState, reassignAction, reassigning] = useActionState(reassignServiceLineAction, undefined);
  const [editing, setEditing] = useState(false);
  const formId = useId();
  const busy = statusPending || removing || reassigning;
  const completed = line.status === "completed";
  const options = eligibleTeam(view, line.serviceId).filter((m) => m.id !== line.staffId);
  const fieldErrors = reassignState && !reassignState.ok ? reassignState.error.fieldErrors : undefined;
  const error = [statusState, removeState, reassignState].map((s) => (s && !s.ok && s.error.code !== "VALIDATION" ? s.error.message : undefined)).find(Boolean);
  // The person recorded at completion can differ from who is credited now (after a correction): show both.
  const corrected = completed && line.performedByName && line.performedByName !== line.staffName;

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-md font-medium text-on-surface">{line.name}</p>
          <p className="text-label-sm text-secondary">
            {line.durationMinutes} min · {formatMoney(line.priceCents, view.currency)}
          </p>
          <p className="mt-1 text-label-sm text-on-surface-variant">
            {line.staffName ? `Team member: ${line.staffName}` : "No team member yet"}
            {corrected && <span className="block text-secondary">Originally recorded as done by {line.performedByName}</span>}
            {completed && line.completedAt && !corrected && line.performedByName && (
              <span className="block text-secondary">
                Done by {line.performedByName} at {formatClock(line.completedAt, view.timezone)}
              </span>
            )}
          </p>
        </div>
        <Badge tone={TONE[line.status]} dot>
          {SERVICE_LINE_STATUS_LABELS[line.status]}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" aria-busy={busy}>
        {view.canManage && line.status === "pending" && (
          <form action={statusAction}>
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <input type="hidden" name="lineId" value={line.id} />
            <Button type="submit" name="status" value="in_progress" variant="accent" size="sm" disabled={busy}>
              Start
            </Button>
          </form>
        )}
        {view.canManage && line.status === "in_progress" && (
          <form action={statusAction}>
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <input type="hidden" name="lineId" value={line.id} />
            <Button type="submit" name="status" value="completed" variant="accent" size="sm" disabled={busy}>
              Mark done
            </Button>
          </form>
        )}
        {view.canReassign && options.length > 0 && (
          <Button type="button" variant="ghost" size="sm" aria-expanded={editing} aria-controls={formId} onClick={() => setEditing((v) => !v)}>
            {completed ? "Correct team member" : "Change team member"}
          </Button>
        )}
        {view.canManage && line.status === "pending" && view.appointment.services.length > 1 && (
          <form
            action={removeAction}
            onSubmit={(event) => {
              if (!window.confirm(`Remove ${line.name} from this appointment?`)) event.preventDefault();
            }}
          >
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <input type="hidden" name="lineId" value={line.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-error" disabled={busy}>
              Remove
            </Button>
          </form>
        )}
      </div>

      {editing && (
        <form
          id={formId}
          action={reassignAction}
          className="mt-3 grid gap-3 rounded-control bg-surface-container-low p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input type="hidden" name="lineId" value={line.id} />
          <Field label="New team member" htmlFor={`${formId}-staff`} errors={fieldErrors?.staffId}>
            <Select id={`${formId}-staff`} name="staffId" defaultValue="" aria-invalid={fieldErrors?.staffId ? true : undefined} required>
              <option value="" disabled>
                Choose a team member
              </option>
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.title ? ` — ${m.title}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={completed ? "Reason (required)" : "Reason (optional)"}
            htmlFor={`${formId}-reason`}
            errors={fieldErrors?.reason}
            hint={completed ? "Kept in the history. The original record of who did the service is not changed, and receipts already issued stay as they are." : undefined}
          >
            <Input
              id={`${formId}-reason`}
              name="reason"
              maxLength={300}
              minLength={completed ? REASSIGN_REASON_MIN : undefined}
              required={completed}
              aria-invalid={fieldErrors?.reason ? true : undefined}
              placeholder={completed ? "e.g. Entered the wrong stylist at check-in" : "Optional"}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={busy}>
              {reassigning ? "Saving…" : completed ? "Save correction" : "Move service"}
            </Button>
          </div>
        </form>
      )}
      <ErrorLine message={error} />
    </li>
  );
}

function AddServiceForm({ view }: { view: AppointmentServicesView }) {
  const [state, action, pending] = useActionState(addServiceLineAction, undefined);
  const [serviceId, setServiceId] = useState("");
  const id = useId();
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;
  const formError = state && !state.ok && state.error.code !== "VALIDATION" ? state.error.message : undefined;
  const atLimit = view.appointment.services.length >= MAX_SERVICES_PER_APPOINTMENT;
  const team = eligibleTeam(view, serviceId || null);

  if (atLimit) {
    return <p className="text-body-sm text-secondary">This appointment already has the maximum of {MAX_SERVICES_PER_APPOINTMENT} services.</p>;
  }
  if (!view.addable.length) {
    return <p className="text-body-sm text-secondary">Every service this branch offers is already on the appointment.</p>;
  }
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-busy={pending}>
      <input type="hidden" name="appointmentId" value={view.appointment.id} />
      <Field label="Service" htmlFor={`${id}-service`} errors={fieldErrors?.serviceId}>
        <Select
          id={`${id}-service`}
          name="serviceId"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          aria-invalid={fieldErrors?.serviceId ? true : undefined}
          aria-describedby={fieldErrors?.serviceId ? `${id}-service-error` : undefined}
        >
          <option value="">Choose a service</option>
          {view.addable.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.durationMinutes} min · {formatMoney(s.priceCents, view.currency)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Team member" htmlFor={`${id}-staff`} errors={fieldErrors?.staffId} hint="Defaults to the appointment's team member.">
        <Select id={`${id}-staff`} name="staffId" defaultValue="" aria-invalid={fieldErrors?.staffId ? true : undefined}>
          <option value="">{view.appointment.staffName ? `Same as appointment (${view.appointment.staffName})` : "Unassigned"}</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.title ? ` — ${m.title}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" icon="plus" disabled={pending || !serviceId}>
        {pending ? "Adding…" : "Add service"}
      </Button>
      <div className="sm:col-span-3">
        <ErrorLine message={formError} />
      </div>
    </form>
  );
}

/** The services of one appointment: progress, who has each, and a history of every change. */
export function ServiceLines({ view }: { view: AppointmentServicesView }) {
  const { appointment, timezone } = view;
  const readOnly = view.source === "demo";
  const remaining = appointment.services.filter((l) => l.status !== "completed").length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {appointment.status === "completed" ? (
        <p role="note" className="rounded-control bg-surface-container-low p-4 text-body-sm text-secondary">
          This appointment is completed, so its services are fixed. If the wrong team member was recorded you can still correct it; the original record and a
          reason are kept in the history, and receipts that were already issued are not changed.
        </p>
      ) : !view.canManage ? (
        <p role="note" className="rounded-control bg-surface-container-low p-4 text-body-sm text-secondary">
          Services can be managed once the appointment is checked in, and until it is completed.
        </p>
      ) : remaining > 0 ? (
        <p role="note" className="rounded-control bg-surface-container-low p-4 text-body-sm text-secondary">
          {remaining} {remaining === 1 ? "service is" : "services are"} not done yet. Finishing a service does not complete the appointment: do that from the
          Appointments screen when everything is done.
        </p>
      ) : null}

      <Card padding="lg">
        <CardHeader
          title="Services"
          description={`${formatDay(zonedDateString(appointment.startsAt, timezone))} · ${formatClock(appointment.startsAt, timezone)}${appointment.customerName ? ` · ${appointment.customerName}` : ""}`}
        />
        <ul className="divide-y divide-outline-variant/15">
          {appointment.services.map((line) => (
            <LineRow key={line.id} line={line} view={view} />
          ))}
        </ul>
      </Card>

      {view.canManage && !readOnly && (
        <Card padding="lg">
          <CardHeader title="Add a service" description={`Up to ${MAX_SERVICES_PER_APPOINTMENT} services per appointment.`} />
          <AddServiceForm view={view} />
        </Card>
      )}

      <Card padding="lg">
        <CardHeader title="History" description="Every change to this appointment's services, oldest first." />
        {view.events.length ? (
          <ol className="space-y-3">
            {view.events.map((event) => (
              <li key={event.id} className="text-body-sm text-on-surface">
                <time dateTime={event.createdAt.toISOString()} className="mr-2 text-label-sm text-secondary">
                  {formatClock(event.createdAt, timezone)}
                </time>
                {EVENT_TEXT[event.kind](event)}
                {event.reason && <span className="block text-label-sm text-secondary">Reason: {event.reason}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body-sm text-secondary">Nothing has changed yet.</p>
        )}
      </Card>
    </div>
  );
}
