"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { centsToInputValue, formatMoney, parseMoneyToCents } from "@/lib/format";
import { recordPaymentAction } from "@/server/billing/actions";
import {
  MAX_CHECKOUT_LINES,
  MAX_CUSTOM_NAME_LENGTH,
  MAX_PAYMENT_SPLITS,
  MAX_TIP_ROWS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type CheckoutLine,
  type CheckoutView,
  type PaymentMethod,
} from "@/server/billing/schema";

/** A tip row with its amount as typed. Several rows may name the same team member. */
type TipRow = { id: number; staffId: string; amount: string };
type Split = { id: number; method: PaymentMethod; amount: string };
/** A bill line with its price as typed, so a half-edited value ("12.") doesn't fight the user. */
type EditableLine = CheckoutLine & { priceText: string };

const toEditable = (line: CheckoutLine): EditableLine => ({ ...line, priceText: centsToInputValue(line.priceCents) });

const dateFmt = (at: Date, timeZone: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(at);

/**
 * Bill editor + payment entry for one completed appointment. Totals shown here are previews: the server
 * re-prices every line and rejects payments that don't add up to its own total.
 */
export function CheckoutForm({ view }: { view: CheckoutView }) {
  const readOnly = view.source === "demo";
  const [state, formAction, pending] = useActionState(recordPaymentAction, undefined);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const nextKey = useRef(0);

  const [lines, setLines] = useState<EditableLine[]>(() => view.lines.map(toEditable));
  const [tipRows, setTipRows] = useState<TipRow[]>([]);
  const [addServiceId, setAddServiceId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customError, setCustomError] = useState<string>();
  // null = one payment for the full total; otherwise the editable split rows.
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [splits, setSplits] = useState<Split[] | null>(null);

  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;
  const formLevelError = state && !state.ok && state.error.code !== "VALIDATION" ? state.error.message : undefined;
  useEffect(() => {
    if (state && !state.ok) feedbackRef.current?.focus();
  }, [state]);

  const money = (cents: number) => formatMoney(cents, view.currency);
  const priceOf = (line: EditableLine) => parseMoneyToCents(line.priceText);
  const linesValid = lines.every((l) => priceOf(l) !== null);
  const subtotal = lines.reduce((sum, l) => sum + (priceOf(l) ?? 0), 0);
  // No rows = no tip. Every row needs someone to credit and an amount above zero.
  const tipAmount = (row: TipRow) => parseMoneyToCents(row.amount);
  const tipRowError = (row: TipRow) => (!row.staffId ? "Choose who the tip is for" : !(tipAmount(row)! > 0) ? "Enter a tip above zero" : undefined);
  const tipValid = tipRows.every((r) => tipRowError(r) === undefined);
  const tip = tipRows.reduce((sum, r) => sum + (tipAmount(r) ?? 0), 0);
  const total = subtotal + tip;
  const allocations: { method: PaymentMethod; amountCents: number | null }[] = splits
    ? splits.map((s) => ({ method: s.method, amountCents: parseMoneyToCents(s.amount) }))
    : [{ method, amountCents: total }];
  const allocated = allocations.reduce((sum, a) => sum + (a.amountCents ?? 0), 0);
  const remaining = total - allocated;
  const splitsValid = allocations.every((a) => a.amountCents !== null && a.amountCents > 0);
  const canPay = !readOnly && lines.length > 0 && linesValid && tipValid && subtotal > 0 && remaining === 0 && splitsValid;

  const inBill = new Set(lines.flatMap((l) => (l.serviceId ? [l.serviceId] : [])));
  const addable = view.catalog.filter((s) => !inBill.has(s.id));

  const addCatalogLine = () => {
    const service = view.catalog.find((s) => s.id === addServiceId);
    if (!service || lines.length >= MAX_CHECKOUT_LINES) return;
    setLines((current) => [...current, toEditable({ key: `new-${nextKey.current++}`, kind: "catalog", serviceId: service.id, name: service.name, priceCents: service.priceCents })]);
    setAddServiceId("");
  };

  const addCustomLine = () => {
    const name = customName.trim();
    const priceCents = parseMoneyToCents(customPrice);
    if (!name) return setCustomError("Enter a name for the item");
    if (!priceCents) return setCustomError("Enter a price above zero");
    if (lines.length >= MAX_CHECKOUT_LINES) return setCustomError(`A bill can have at most ${MAX_CHECKOUT_LINES} items`);
    setLines((current) => [...current, toEditable({ key: `new-${nextKey.current++}`, kind: "custom", serviceId: null, name, priceCents })]);
    setCustomName("");
    setCustomPrice("");
    setCustomError(undefined);
  };

  const addTipRow = () => {
    if (tipRows.length >= MAX_TIP_ROWS) return;
    setTipRows((current) => [...current, { id: nextKey.current++, staffId: current.length ? "" : (view.defaultTipStaffId ?? ""), amount: "" }]);
  };
  const updateTipRow = (id: number, patch: Partial<TipRow>) => setTipRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const startSplit = () => setSplits([{ id: 0, method, amount: (total / 100).toFixed(2) }, { id: 1, method: method === "cash" ? "card" : "cash", amount: "" }]);
  const updateSplit = (id: number, patch: Partial<Split>) => setSplits((current) => current?.map((s) => (s.id === id ? { ...s, ...patch } : s)) ?? null);

  const payload = JSON.stringify({
    appointmentId: view.appointment.id,
    lines: lines.map((l) =>
      l.kind === "custom" ? { kind: "custom", name: l.name, priceCents: priceOf(l) ?? 0 } : { kind: "catalog", serviceId: l.serviceId, priceCents: priceOf(l) ?? 0 },
    ),
    tips: tipRows.map((r) => ({ staffId: r.staffId, amountCents: tipAmount(r) ?? 0 })),
    payments: allocations.map((a) => ({ method: a.method, amountCents: a.amountCents ?? 0 })),
  });

  return (
    <form action={formAction} noValidate className="mx-auto grid max-w-5xl grid-cols-1 gap-gutter lg:grid-cols-12">
      <input type="hidden" name="payload" value={payload} />

      <div className="flex flex-col gap-6 lg:col-span-8">
        <Card padding="lg" className="p-6 md:p-8">
          <CardHeader title="Client & appointment" />
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              ["Customer", view.appointment.customerName ?? "Walk-in"],
              ["Branch", view.appointment.branchName],
              ["Appointment", dateFmt(view.appointment.startsAt, view.timezone)],
              ["Stylist", view.appointment.staffName ?? "Unassigned"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="eyebrow mb-1">{label}</dt>
                <dd className="text-body-md text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card padding="lg" className="p-6 md:p-8">
          <CardHeader title="Services" description="Everything booked on this appointment. Edit a price, or add or remove items, before taking payment. Price changes apply to this bill only." />
          {lines.length ? (
            <ul className="divide-y divide-outline-variant/15">
              {lines.map((line) => (
                <li key={line.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-medium text-on-surface">{line.name}</p>
                    <p className="text-label-sm text-secondary">{line.kind === "custom" ? "One-off item" : (view.appointment.staffName ?? "Unassigned")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Price for ${line.name}`}
                      inputMode="decimal"
                      className="w-28 text-right"
                      value={line.priceText}
                      onChange={(e) => setLines((current) => current.map((l) => (l.key === line.key ? { ...l, priceText: e.target.value } : l)))}
                      aria-invalid={priceOf(line) === null ? true : undefined}
                    />
                    <Button type="button" variant="ghost" size="sm" className="px-2" aria-label={`Remove ${line.name}`} onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}>
                      <Icon name="close" size={16} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-control bg-surface-container-low p-4 text-body-sm text-secondary">The bill is empty. Add a service to continue.</p>
          )}
          {fieldErrors?.lines?.length ? (
            <p role="alert" className="mt-3 text-label-sm text-error">
              {fieldErrors.lines[0]}
            </p>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-6 border-t border-outline-variant/15 pt-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="add-service" className="text-label-md text-on-surface-variant">
                Add a catalog service
              </label>
              <div className="flex gap-2">
                <Select id="add-service" value={addServiceId} onChange={(e) => setAddServiceId(e.target.value)} disabled={!addable.length}>
                  <option value="">{addable.length ? "Select service" : "No more services"}</option>
                  {addable.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {money(s.priceCents)}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="secondary" onClick={addCatalogLine} disabled={!addServiceId}>
                  Add
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="custom-name" className="text-label-md text-on-surface-variant">
                Add a one-off item
              </label>
              <div className="flex gap-2">
                <Input id="custom-name" placeholder="Description" maxLength={MAX_CUSTOM_NAME_LENGTH} value={customName} onChange={(e) => setCustomName(e.target.value)} aria-invalid={customError ? true : undefined} />
                <Input aria-label="One-off item price" inputMode="decimal" placeholder="0.00" className="w-28" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} aria-invalid={customError ? true : undefined} />
                <Button type="button" variant="secondary" onClick={addCustomLine}>
                  Add
                </Button>
              </div>
              {customError ? <p className="text-label-sm text-error">{customError}</p> : <p className="text-label-sm text-secondary">Billed on this receipt only; the service catalog is not changed.</p>}
            </div>
          </div>
        </Card>

        <Card padding="lg" className="p-6 md:p-8">
          <CardHeader
            title="Gratuity / Tips"
            description="Allocate gratuity individually across your team. A team member can have more than one tip."
            action={
              <p className="rounded-control bg-primary-container/20 px-3 py-1.5 text-label-md text-on-surface-variant" aria-live="polite">
                Total Gratuity: <span className="font-headline text-body-lg font-bold text-primary">{money(tip)}</span>
              </p>
            }
          />
          {tipRows.length ? (
            <ul className="flex flex-col gap-3">
              {tipRows.map((row, index) => {
                const error = tipRowError(row);
                const touched = row.amount !== "" || row.staffId !== "";
                return (
                  <li key={row.id} className="flex flex-col gap-1 rounded-control border border-outline-variant/20 p-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-48 flex-1">
                        <Field label="Staff member" htmlFor={`tip-staff-${row.id}`}>
                          <Select id={`tip-staff-${row.id}`} value={row.staffId} onChange={(e) => updateTipRow(row.id, { staffId: e.target.value })} aria-invalid={error && !row.staffId ? true : undefined}>
                            <option value="">Select team member</option>
                            {view.staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                      <div className="w-36">
                        <Field label="Tip amount" htmlFor={`tip-amount-${row.id}`}>
                          <Input
                            id={`tip-amount-${row.id}`}
                            inputMode="decimal"
                            placeholder="0.00"
                            value={row.amount}
                            onChange={(e) => updateTipRow(row.id, { amount: e.target.value })}
                            aria-invalid={error && row.staffId ? true : undefined}
                            aria-describedby={error && touched ? `tip-error-${row.id}` : undefined}
                          />
                        </Field>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="mb-1 px-2" aria-label={`Remove tip ${index + 1}`} onClick={() => setTipRows((current) => current.filter((r) => r.id !== row.id))}>
                        <Icon name="close" size={16} />
                      </Button>
                    </div>
                    {error && touched ? (
                      <p id={`tip-error-${row.id}`} className="text-label-sm text-error">
                        {error}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-control bg-surface-container-low p-4 text-body-sm text-secondary">No tips added. Use “Add Staff Tip” to credit gratuity to a team member.</p>
          )}
          {fieldErrors?.tips?.length ? (
            <p role="alert" className="mt-3 text-label-sm text-error">
              {fieldErrors.tips[0]}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="secondary" size="sm" icon="plus" onClick={addTipRow} disabled={tipRows.length >= MAX_TIP_ROWS || !view.staff.length}>
              Add Staff Tip
            </Button>
            <span className="text-label-sm text-secondary">
              {!view.staff.length ? "No active team members at this branch." : tipRows.length >= MAX_TIP_ROWS ? `At most ${MAX_TIP_ROWS} tips per bill.` : `${tipRows.length} ${tipRows.length === 1 ? "tip" : "tips"} added`}
            </span>
          </div>
        </Card>
      </div>

      <aside className="lg:col-span-4">
        <Card padding="lg" className="sticky top-6 p-6">
          <h2 className="mb-4 font-headline text-headline-sm font-semibold text-on-surface">Payment</h2>
          <dl className="space-y-2 text-body-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-secondary">Subtotal</dt>
              <dd className="font-medium text-on-surface">{money(subtotal)}</dd>
            </div>
            {tip > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-secondary">Total Gratuity</dt>
                <dd className="font-medium text-on-surface">{money(tip)}</dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-3">
            <span className="text-label-md text-secondary">Total due</span>
            <span className="font-headline text-headline-sm font-semibold text-on-surface">{money(total)}</span>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {splits ? (
              <>
                {splits.map((split) => (
                  <div key={split.id} className="flex items-end gap-2">
                    <Field label="Method" htmlFor={`split-method-${split.id}`}>
                      <Select id={`split-method-${split.id}`} value={split.method} onChange={(e) => updateSplit(split.id, { method: e.target.value as PaymentMethod })}>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Amount" htmlFor={`split-amount-${split.id}`}>
                      <Input id={`split-amount-${split.id}`} inputMode="decimal" placeholder="0.00" value={split.amount} onChange={(e) => updateSplit(split.id, { amount: e.target.value })} aria-invalid={split.amount && parseMoneyToCents(split.amount) === null ? true : undefined} />
                    </Field>
                    {splits.length > 2 && (
                      <Button type="button" variant="ghost" size="sm" className="mb-1 px-2" aria-label="Remove payment" onClick={() => setSplits((current) => current?.filter((s) => s.id !== split.id) ?? null)}>
                        <Icon name="close" size={16} />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {splits.length < MAX_PAYMENT_SPLITS && (
                    <Button type="button" variant="ghost" size="sm" icon="plus" className="-ml-3" onClick={() => setSplits((current) => [...(current ?? []), { id: Math.max(...(current ?? [{ id: -1 }]).map((s) => s.id)) + 1, method: "cash", amount: remaining > 0 ? (remaining / 100).toFixed(2) : "" }])}>
                      Add payment
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSplits(null)}>
                    Single payment
                  </Button>
                </div>
                <p className={remaining === 0 ? "text-label-md text-on-success-container" : "text-label-md text-error"} aria-live="polite">
                  {remaining === 0 ? "Payments match the total." : remaining > 0 ? `${money(remaining)} still to allocate.` : `${money(-remaining)} over the total.`}
                </p>
              </>
            ) : (
              <>
                <Field label="Payment method" htmlFor="method">
                  <Select id="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="button" variant="ghost" size="sm" className="-ml-3 self-start" onClick={startSplit} disabled={total <= 0}>
                  Split payment
                </Button>
              </>
            )}
          </div>

          <div ref={feedbackRef} tabIndex={-1} aria-live="polite" className="mt-4 empty:hidden focus:outline-none">
            {readOnly ? (
              <p role="note" className="rounded-control bg-surface-container-low p-3 text-body-sm text-secondary">
                Demo data is read-only. Connect a database to take payments.
              </p>
            ) : formLevelError ? (
              <p role="alert" className="rounded-control bg-error-container p-3 text-body-sm text-on-error-container">
                {formLevelError}
              </p>
            ) : fieldErrors?.payments?.length ? (
              <p role="alert" className="rounded-control bg-error-container p-3 text-body-sm text-on-error-container">
                {fieldErrors.payments[0]}
              </p>
            ) : fieldErrors && !fieldErrors.lines && !fieldErrors.tips ? (
              <p role="alert" className="rounded-control bg-error-container p-3 text-body-sm text-on-error-container">
                {Object.values(fieldErrors)[0]?.[0]}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button type="submit" fullWidth icon="banknote" disabled={pending || !canPay}>
              {pending ? "Recording…" : `Record payment · ${money(total)}`}
            </Button>
            <ButtonLink href="/appointments" variant="ghost" fullWidth>
              Back to Appointments
            </ButtonLink>
          </div>
        </Card>
      </aside>
    </form>
  );
}
