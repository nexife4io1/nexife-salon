"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { bookAppointmentAction } from "@/server/appointments/actions";
import { APPOINTMENT_TYPES, APPOINTMENT_TYPE_LABELS, MAX_SERVICES_PER_APPOINTMENT, type AppointmentType, type BookingOptions } from "@/server/appointments/schema";

export type BookingPrefill = { branchId?: string; staffId?: string; date?: string; customerId?: string };

const CUSTOMER_LIMIT = 100;

function Section({ step, icon, title, description, children }: { step: number; icon: IconName; title: string; description?: string; children: ReactNode }) {
  return (
    <Card padding="lg" className="p-6 md:p-8">
      <h2 className="mb-1 flex items-center gap-3 font-headline text-headline-sm font-semibold text-on-surface">
        <span className="grid size-7 place-items-center rounded-full bg-primary-container text-label-md text-on-primary-container" aria-hidden>
          {step}
        </span>
        {title}
        <Icon name={icon} size={18} className="text-secondary" />
      </h2>
      {description ? <p className="mb-6 text-body-sm text-secondary">{description}</p> : <div className="mb-5" />}
      {children}
    </Card>
  );
}

/** "10:00" plus minutes as "HH:MM" on the same wall clock (display only; the server decides the real instant). */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function BookingForm({ options, prefill = {} }: { options: BookingOptions; prefill?: BookingPrefill }) {
  const readOnly = options.source === "demo";
  const [state, formAction, pending] = useActionState(bookAppointmentAction, undefined);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;
  const formLevelError = state && !state.ok && state.error.code !== "VALIDATION" && state.error.code !== "CONFLICT" ? state.error.message : undefined;

  const firstBranch = options.branches.find((b) => b.id === prefill.branchId) ?? (options.branches.length === 1 ? options.branches[0] : undefined);
  const [type, setType] = useState<AppointmentType>("booking");
  const [branchId, setBranchId] = useState(firstBranch?.id ?? "");
  // One entry per service row; "" is a row that has no service chosen yet.
  const [serviceIds, setServiceIds] = useState<string[]>([""]);
  const [staffId, setStaffId] = useState(prefill.staffId && options.staff.some((s) => s.id === prefill.staffId && s.branchId === firstBranch?.id) ? prefill.staffId : "");
  const [customerId, setCustomerId] = useState(prefill.customerId && options.customers.some((c) => c.id === prefill.customerId) ? prefill.customerId : "");
  const [customerQuery, setCustomerQuery] = useState("");
  const [date, setDate] = useState(prefill.date && prefill.date >= options.today ? prefill.date : options.today);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const offered = new Set(options.offeredByBranch[branchId] ?? []);
  const services = options.services.filter((s) => offered.has(s.id));
  const team = options.staff.filter((s) => s.branchId === branchId);
  const chosenServices = serviceIds.flatMap((id) => services.find((s) => s.id === id) ?? []);
  const totalMinutes = chosenServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalCents = chosenServices.reduce((sum, s) => sum + s.priceCents, 0);
  const member = team.find((s) => s.id === staffId);
  const customer = options.customers.find((c) => c.id === customerId);
  const walkIn = type === "walk_in";
  const q = customerQuery.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const matchedCustomers = q
    ? options.customers.filter((c) => c.id === customerId || c.name.toLowerCase().includes(q) || (qDigits && (c.phone ?? "").replace(/\D/g, "").includes(qDigits)))
    : options.customers;

  const chooseBranch = (next: string) => {
    setBranchId(next);
    const nextOffered = new Set(options.offeredByBranch[next] ?? []);
    setServiceIds((current) => current.map((id) => (nextOffered.has(id) ? id : "")));
    if (!options.staff.some((s) => s.id === staffId && s.branchId === next)) setStaffId("");
  };

  const ctl = (name: string) => ({
    id: name,
    name,
    "aria-invalid": fieldErrors?.[name] ? true : undefined,
    "aria-describedby": fieldErrors?.[name] ? `${name}-error` : undefined,
  });
  const invalidCount = fieldErrors ? Object.keys(fieldErrors).length : 0;
  const setServiceAt = (index: number, id: string) => setServiceIds((current) => current.map((value, i) => (i === index ? id : value)));
  const removeServiceAt = (index: number) => setServiceIds((current) => (current.length === 1 ? [""] : current.filter((_, i) => i !== index)));

  // After a failed submit, move focus to the first invalid field (or the message for form-level errors).
  useEffect(() => {
    if (!state || state.ok) return;
    const first = document.querySelector<HTMLElement>("form [aria-invalid='true']");
    (first ?? feedbackRef.current)?.focus();
  }, [state]);

  const timeLabel = walkIn ? "Starts right away" : date && time ? `${date} · ${time}${totalMinutes ? ` – ${addMinutes(time, totalMinutes)}` : ""}` : "Not chosen yet";

  return (
    <form action={formAction} noValidate className="mx-auto grid max-w-5xl grid-cols-1 gap-gutter lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-8">
        <Section step={1} icon="user" title="Client & Branch Details">
          <fieldset className="mb-6">
            <legend className="mb-2 text-label-md text-on-surface-variant">Booking type</legend>
            <div className="inline-flex gap-1 rounded-control bg-surface-container-low p-1">
              {APPOINTMENT_TYPES.map((t) => (
                <label key={t} className="cursor-pointer">
                  <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="peer sr-only" />
                  <span
                    className={cn(
                      "block rounded-control px-4 py-1.5 text-label-md text-on-surface-variant transition-colors",
                      "peer-checked:bg-surface-container-lowest peer-checked:text-on-surface peer-checked:shadow-card peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container",
                    )}
                  >
                    {APPOINTMENT_TYPE_LABELS[t]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field
              label={walkIn ? "Customer (optional)" : "Customer"}
              htmlFor="customerId"
              errors={fieldErrors?.customerId}
              hint={
                options.customers.length >= CUSTOMER_LIMIT
                  ? `Showing the first ${CUSTOMER_LIMIT} customers.`
                  : !options.customers.length
                    ? "No customers yet. Add one from Customers, or book a walk-in."
                    : undefined
              }
            >
              <Input
                type="search"
                aria-label="Search customers by name or phone"
                placeholder="Search by name or phone"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                className="mb-2"
              />
              <Select {...ctl("customerId")} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{walkIn ? "Walk-in (no customer on file)" : q && !matchedCustomers.length ? "No matching customers" : "Select customer"}</option>
                {matchedCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </Select>
              {!readOnly && (
                <ButtonLink href="/customers/new?from=booking" variant="ghost" size="sm" icon="plus" className="-ml-3 self-start">
                  New client
                </ButtonLink>
              )}
            </Field>
            <Field label="Salon branch" htmlFor="branchId" errors={fieldErrors?.branchId}>
              <Select {...ctl("branchId")} value={branchId} onChange={(e) => chooseBranch(e.target.value)} required>
                <option value="" disabled>
                  Select branch
                </option>
                {options.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.status === "opening_soon" ? " (opening soon)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {!walkIn && (
              <>
                <Field label="Appointment date" htmlFor="date" errors={fieldErrors?.date} hint={`Times are in ${options.timezone}.`}>
                  <Input {...ctl("date")} type="date" min={options.today} value={date} onChange={(e) => setDate(e.target.value)} required />
                </Field>
                <Field label="Appointment time" htmlFor="time" errors={fieldErrors?.time}>
                  <Input {...ctl("time")} type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required />
                </Field>
              </>
            )}
          </div>
        </Section>

        <Section step={2} icon="scissors" title="Service & Stylist">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <fieldset aria-describedby={fieldErrors?.serviceId ? "serviceId-error" : undefined}>
                <legend className="mb-2 text-label-md text-on-surface-variant">Services</legend>
                <ul className="flex flex-col gap-3">
                  {serviceIds.map((id, index) => {
                    const row = services.find((s) => s.id === id);
                    const taken = new Set(serviceIds.filter((other, i) => other && i !== index));
                    return (
                      <li key={index} className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[1fr_6rem_6rem_auto]">
                        <Select
                          id={index === 0 ? "serviceId" : undefined}
                          name="serviceId"
                          aria-label={`Service ${index + 1}`}
                          aria-invalid={fieldErrors?.serviceId ? true : undefined}
                          value={id}
                          onChange={(e) => setServiceAt(index, e.target.value)}
                          disabled={!branchId}
                          className="col-span-2 sm:col-span-1"
                        >
                          <option value="">{branchId ? "Select service" : "Choose a branch first"}</option>
                          {services
                            .filter((s) => !taken.has(s.id))
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </Select>
                        <span className="text-body-sm text-secondary sm:text-right">{row ? `${row.durationMinutes} min` : "—"}</span>
                        <span className="text-body-sm font-medium text-on-surface sm:text-right">{row ? formatMoney(row.priceCents, options.currency) : "—"}</span>
                        <Button type="button" variant="ghost" size="sm" className="px-2" aria-label={`Remove service ${index + 1}`} onClick={() => removeServiceAt(index)} disabled={serviceIds.length === 1 && !id}>
                          <Icon name="close" size={16} />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                {fieldErrors?.serviceId?.length ? (
                  <p className="mt-2 text-label-sm text-error" id="serviceId-error">
                    {fieldErrors.serviceId[0]}
                  </p>
                ) : branchId && !services.length ? (
                  <p className="mt-2 text-label-sm text-secondary">This branch doesn&apos;t offer any services yet. Add some from its branch page.</p>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon="plus"
                  className="mt-2 -ml-3"
                  onClick={() => setServiceIds((current) => [...current, ""])}
                  disabled={!branchId || serviceIds.length >= MAX_SERVICES_PER_APPOINTMENT || serviceIds.some((id) => !id) || serviceIds.length >= services.length}
                >
                  Add service
                </Button>
              </fieldset>
            </div>
            <Field label="Stylist (optional)" htmlFor="staffId" errors={fieldErrors?.staffId} hint={!staffId ? "Leave unassigned to pick someone at check-in." : undefined}>
              <Select {...ctl("staffId")} value={staffId} onChange={(e) => setStaffId(e.target.value)} disabled={!branchId}>
                <option value="">Unassigned</option>
                {team.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.title ? ` — ${s.title}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes (optional)" htmlFor="notes" errors={fieldErrors?.notes}>
                <textarea
                  {...ctl("notes")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Allergies, preferences, anything the team should know"
                  className="w-full rounded-control border-[1.5px] border-transparent bg-surface-container-low px-4 py-3 text-body-sm text-on-surface transition-colors placeholder:text-secondary/70 focus:border-primary-container focus:bg-surface-container-lowest focus:outline-none aria-invalid:border-error/60"
                />
              </Field>
            </div>
          </div>
        </Section>
      </div>

      <aside className="lg:col-span-4">
        <Card padding="lg" className="sticky top-6 p-6">
          <h2 className="mb-4 font-headline text-headline-sm font-semibold text-on-surface">Booking summary</h2>
          <dl className="space-y-3 text-body-sm">
            {[
              ["Client", walkIn ? (customer?.name ?? "Walk-in") : (customer?.name ?? "Not chosen yet")],
              ["Branch", options.branches.find((b) => b.id === branchId)?.name ?? "Not chosen yet"],
              ["When", timeLabel],
              ["Stylist", member?.name ?? "Unassigned"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-secondary">{label}</dt>
                <dd className="text-right font-medium text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 border-t border-outline-variant/20 pt-4">
            <p className="mb-2 text-label-md text-secondary">Services</p>
            {chosenServices.length ? (
              <ul className="space-y-2 text-body-sm">
                {chosenServices.map((s) => (
                  <li key={s.id} className="flex justify-between gap-4">
                    <span className="text-on-surface">
                      {s.name} <span className="text-secondary">· {s.durationMinutes} min</span>
                    </span>
                    <span className="font-medium text-on-surface">{formatMoney(s.priceCents, options.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-secondary">Not chosen yet</p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-4">
            <span className="text-label-md text-secondary">
              Estimated total{totalMinutes ? ` · ${totalMinutes} min` : ""}
            </span>
            <span className="font-headline text-headline-sm font-semibold text-on-surface">{chosenServices.length ? formatMoney(totalCents, options.currency) : "—"}</span>
          </div>

          <div ref={feedbackRef} tabIndex={-1} aria-live="polite" className="mt-4 empty:hidden focus:outline-none">
            {readOnly ? (
              <p role="note" className="rounded-control bg-surface-container-low p-3 text-body-sm text-secondary">
                Demo data is read-only. Connect a database to take bookings.
              </p>
            ) : formLevelError ? (
              <p role="alert" className="rounded-control bg-error-container p-3 text-body-sm text-on-error-container">
                {formLevelError}
              </p>
            ) : state && !state.ok && state.error.code === "CONFLICT" ? (
              <p role="alert" className="rounded-control bg-error-container p-3 text-body-sm text-on-error-container">
                {state.error.message}
              </p>
            ) : invalidCount ? (
              <p role="alert" className="rounded-control bg-error-container p-3 text-body-sm text-on-error-container">
                Please fix the {invalidCount === 1 ? "highlighted field" : `${invalidCount} highlighted fields`}.
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button type="submit" fullWidth icon="calendar" disabled={pending || readOnly}>
              {pending ? "Booking…" : walkIn ? "Add walk-in" : "Confirm booking"}
            </Button>
            <ButtonLink href="/appointments" variant="ghost" fullWidth>
              Cancel
            </ButtonLink>
          </div>
        </Card>
      </aside>
    </form>
  );
}
