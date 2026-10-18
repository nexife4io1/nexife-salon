"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import {
  CUSTOMER_GENDERS,
  CUSTOMER_GENDER_LABELS,
  MAX_NOTES_LENGTH,
  customerFormValues,
  type CustomerFormValues,
  type CustomerProfile,
} from "@/server/customers/schema";
import type { ActionResult } from "@/server/shared/result";

type CustomerFormAction = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
type FormState = ActionResult & { values?: CustomerFormValues };

/** `returnTo="booking"`: the customer is being added from the booking form, so saving goes back to it. */
export function CustomerForm({ action, customer, readOnly, returnTo }: { action: CustomerFormAction; customer?: CustomerProfile; readOnly: boolean; returnTo?: "booking" }) {
  // Failed submits return the typed values so the form keeps them; a successful save redirects away.
  const [state, formAction, pending] = useActionState(
    async (prev: FormState | undefined, formData: FormData): Promise<FormState> => {
      const result = await action(prev, formData);
      return result.ok ? result : { ...result, values: customerFormValues(formData) };
    },
    undefined,
  );
  const submitted = state?.values;
  const text = (name: string, fallback: string | null | undefined = "") => submitted?.[name]?.[0] ?? fallback ?? "";
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;
  const formLevelError = state && !state.ok && state.error.code !== "VALIDATION" ? state.error.message : undefined;
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [notesLength, setNotesLength] = useState((customer?.notes ?? "").length);

  const ctl = (name: string) => ({
    id: name,
    name,
    "aria-invalid": fieldErrors?.[name] ? true : undefined,
    "aria-describedby": fieldErrors?.[name] ? `${name}-error` : undefined,
  });

  // After a failed submit, move focus to the first invalid field (or the message for form-level errors).
  useEffect(() => {
    if (!state || state.ok) return;
    const first = document.querySelector<HTMLElement>("form [aria-invalid='true']");
    (first ?? feedbackRef.current)?.focus();
  }, [state]);

  const cancelHref = customer ? `/customers/${customer.id}` : returnTo === "booking" ? "/appointments/new" : "/customers";

  return (
    <form action={formAction} noValidate className="mx-auto flex max-w-3xl flex-col gap-6">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      {(formLevelError || readOnly) && (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role={formLevelError ? "alert" : "note"}
          className={cn(
            "rounded-card border px-5 py-4 text-body-sm focus:outline-none",
            formLevelError ? "border-error/30 bg-error-container/40 text-on-error-container" : "border-outline-variant/30 bg-surface-container-low text-secondary",
          )}
        >
          {formLevelError ?? "Demo mode is read-only. Set DATABASE_URL to save customers."}
        </div>
      )}

      <Card padding="lg" className="p-6 md:p-8">
        <h2 className="mb-6 flex items-center gap-2 font-headline text-headline-sm font-semibold text-on-surface">
          <Icon name="user" size={20} className="text-primary-container" />
          Customer Information
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Full name *" htmlFor="name" errors={fieldErrors?.name}>
            <Input {...ctl("name")} defaultValue={text("name", customer?.name)} placeholder="Enter customer name" required maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Contact number *" htmlFor="phone" errors={fieldErrors?.phone} hint="Used to recognise returning customers.">
            <Input {...ctl("phone")} type="tel" defaultValue={text("phone", customer?.phone)} placeholder="Enter contact number" required maxLength={32} autoComplete="off" />
          </Field>
          <Field label="Email address" htmlFor="email" errors={fieldErrors?.email}>
            <Input {...ctl("email")} type="email" defaultValue={text("email", customer?.email)} placeholder="Enter email address" maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Birthday" htmlFor="birthday" errors={fieldErrors?.birthday}>
            <Input {...ctl("birthday")} type="date" defaultValue={text("birthday", customer?.birthday)} min="1900-01-01" />
          </Field>
          <Field label="Gender" htmlFor="gender" errors={fieldErrors?.gender}>
            <Select {...ctl("gender")} defaultValue={text("gender", customer?.gender)}>
              <option value="">Select gender</option>
              {CUSTOMER_GENDERS.map((g) => (
                <option key={g} value={g}>
                  {CUSTOMER_GENDER_LABELS[g]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card padding="lg" className="p-6 md:p-8">
        <h2 className="mb-6 font-headline text-headline-sm font-semibold text-on-surface">Notes</h2>
        <Field label="Notes about this customer" htmlFor="notes" errors={fieldErrors?.notes}>
          <textarea
            {...ctl("notes")}
            rows={5}
            defaultValue={text("notes", customer?.notes)}
            onChange={(e) => setNotesLength(e.target.value.length)}
            placeholder="Preferred stylist, preferences, allergies…"
            className="w-full resize-y rounded-control border-[1.5px] border-transparent bg-surface-container-low px-4 py-3 text-body-sm text-on-surface transition-colors placeholder:text-secondary/70 focus:border-primary-container focus:bg-surface-container-lowest focus:outline-none aria-invalid:border-error/60"
          />
        </Field>
        <p className={cn("mt-2 text-right text-label-sm", notesLength > MAX_NOTES_LENGTH ? "text-error" : "text-secondary")} aria-live="polite">
          {notesLength} / {MAX_NOTES_LENGTH}
        </p>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <ButtonLink href={cancelHref} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={pending || readOnly} aria-busy={pending}>
          {pending ? "Saving…" : customer ? "Save changes" : "Save customer"}
        </Button>
      </div>
    </form>
  );
}
