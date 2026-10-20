"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { centsToInputValue } from "@/lib/format";
import { StaffServicePicker } from "./staff-service-picker";
import type { ActionResult } from "@/server/shared/result";
import {
  MAX_BREAKS,
  STAFF_GENDERS,
  STAFF_GENDER_LABELS,
  STAFF_JOB_ROLES,
  STAFF_JOB_ROLE_LABELS,
  STAFF_STATUSES,
  STAFF_STATUS_LABELS,
  WEEKDAYS,
  WEEKDAY_LABELS,
  staffFormValues,
  type StaffFormOptions,
  type StaffFormValues,
  type StaffProfile,
} from "@/server/staff/schema";

type StaffFormAction = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
type FormState = ActionResult & { values?: StaffFormValues };
type BreakRow = { key: number; label: string; start: string; end: string };

function Section({ icon, title, description, children }: { icon: IconName; title: string; description?: string; children: ReactNode }) {
  return (
    <Card padding="lg" className="p-6 md:p-8">
      <h2 className="mb-1 flex items-center gap-2 font-headline text-headline-sm font-semibold text-on-surface">
        <Icon name={icon} size={20} className="text-primary-container" />
        {title}
      </h2>
      {description && <p className="mb-6 text-body-sm text-secondary">{description}</p>}
      {!description && <div className="mb-5" />}
      {children}
    </Card>
  );
}

/** Honest placeholder: uploads need a secure storage integration this project does not have yet. */
function UnavailableUpload({ title, hint }: { title: string; hint: string }) {
  return (
    <div role="note" className="flex items-start gap-4 rounded-card border border-dashed border-outline-variant bg-surface-container-low/50 p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container text-secondary">
        <Icon name="shield" size={20} />
      </span>
      <div>
        <p className="text-label-md text-on-surface">{title}</p>
        <p className="mt-1 text-body-sm text-secondary">{hint}</p>
      </div>
    </div>
  );
}

function currencySymbol(currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function StaffForm({ action, options, profile }: { action: StaffFormAction; options: StaffFormOptions; profile?: StaffProfile }) {
  // Failed submits return the typed values so the form keeps them; a successful save redirects away.
  const [state, formAction, pending] = useActionState(
    async (prev: FormState | undefined, formData: FormData): Promise<FormState> => {
      const result = await action(prev, formData);
      return result.ok ? result : { ...result, values: staffFormValues(formData) };
    },
    undefined,
  );
  const submitted: StaffFormValues | undefined = state?.values;
  const text = (name: string, fallback: string | number | null | undefined = "") => submitted?.[name]?.[0] ?? String(fallback ?? "");
  const feedbackRef = useRef<HTMLDivElement>(null);
  const fieldErrors = state && !state.ok ? state.error.fieldErrors : undefined;
  const editing = Boolean(profile);
  const readOnly = options.source === "demo";

  const initialHours = profile?.schedule.hours[0];
  const [breaks, setBreaks] = useState<BreakRow[]>(() =>
    (profile?.schedule.breaks ?? []).map((b, i) => ({ key: i, label: b.label ?? "", start: b.start, end: b.end })),
  );
  const [nextKey, setNextKey] = useState(breaks.length);
  const [branchId, setBranchId] = useState(text("branchId", profile?.branchId));
  const [serviceIds, setServiceIds] = useState<string[]>(submitted?.serviceIds ?? profile?.serviceIds ?? []);
  // Only services the chosen branch offers can be assigned; switching branch drops the rest.
  const offered = new Set(options.offeredByBranch[branchId] ?? []);
  const branchServices = options.services.filter((s) => offered.has(s.id));
  const chosenServiceIds = serviceIds.filter((id) => offered.has(id));

  // Sort branches so inactive ones are only offered when they are the current assignment.
  const branches = options.branches.filter((b) => b.status !== "inactive" || b.id === profile?.branchId);

  const ctl = (name: string) => ({
    id: name,
    name,
    "aria-invalid": fieldErrors?.[name] ? true : undefined,
    "aria-describedby": fieldErrors?.[name] ? `${name}-error` : undefined,
  });
  const breakError = (i: number) => fieldErrors?.[`breaks.${i}.start`]?.[0] ?? fieldErrors?.[`breaks.${i}.end`]?.[0];
  const invalidCount = fieldErrors ? Object.keys(fieldErrors).length : 0;
  const formLevelError = state && !state.ok && state.error.code !== "VALIDATION" ? state.error.message : undefined;

  // After a failed submit, move focus to the first invalid field (or the message for form-level errors).
  useEffect(() => {
    if (!state || state.ok) return;
    const first = document.querySelector<HTMLElement>("form [aria-invalid='true']");
    (first ?? feedbackRef.current)?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate className="mx-auto grid max-w-5xl grid-cols-1 gap-gutter lg:grid-cols-12">
      {profile && <input type="hidden" name="id" value={profile.id} />}

      <div className="flex flex-col gap-6 lg:col-span-8">
        <Section icon="user" title="Staff Information">
          <div className="mb-8">
            <UnavailableUpload
              title="Profile picture"
              hint="Photo upload is switched off until secure file storage is connected. Initials are shown instead."
            />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="Full name" htmlFor="name" errors={fieldErrors?.name}>
              <Input {...ctl("name")} defaultValue={text("name", profile?.name)} placeholder="Enter full name" required autoComplete="off" />
            </Field>
            <Field label="Contact number" htmlFor="phone" errors={fieldErrors?.phone}>
              <Input {...ctl("phone")} type="tel" defaultValue={text("phone", profile?.phone)} placeholder="Enter contact number" autoComplete="off" />
            </Field>
            <Field label="Gender" htmlFor="gender" errors={fieldErrors?.gender}>
              <Select {...ctl("gender")} defaultValue={text("gender", profile?.gender)}>
                <option value="">Select gender</option>
                {STAFF_GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {STAFF_GENDER_LABELS[g]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Emergency contact name" htmlFor="emergencyContactName" errors={fieldErrors?.emergencyContactName}>
              <Input {...ctl("emergencyContactName")} defaultValue={text("emergencyContactName", profile?.emergencyContactName)} placeholder="Enter contact person name" autoComplete="off" />
            </Field>
            <Field label="Address" htmlFor="address" errors={fieldErrors?.address}>
              <Input {...ctl("address")} defaultValue={text("address", profile?.address)} placeholder="Enter residential address" autoComplete="off" />
            </Field>
            <Field label="Emergency contact number" htmlFor="emergencyContactPhone" errors={fieldErrors?.emergencyContactPhone}>
              <Input {...ctl("emergencyContactPhone")} type="tel" defaultValue={text("emergencyContactPhone", profile?.emergencyContactPhone)} placeholder="Enter emergency contact number" autoComplete="off" />
            </Field>
          </div>
        </Section>

        <Section icon="shield" title="ID Proof">
          <UnavailableUpload
            title="Aadhaar card"
            hint="Identity documents can only be uploaded once encrypted, access-controlled storage is set up. Nothing is saved for this field, and no ID number is collected here."
          />
        </Section>

        <Section icon="building" title="Employment Details">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="Branch" htmlFor="branchId" errors={fieldErrors?.branchId}>
              <Select {...ctl("branchId")} value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
                <option value="" disabled>
                  Select branch
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.status === "inactive" ? " (inactive)" : b.status === "opening_soon" ? " (opening soon)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`Monthly salary (${options.currency})`} htmlFor="monthlySalary" errors={fieldErrors?.monthlySalaryCents}>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-body-sm text-secondary" aria-hidden>
                  {currencySymbol(options.currency)}
                </span>
                <Input
                  id="monthlySalary"
                  name="monthlySalaryCents"
                  inputMode="decimal"
                  className="pl-9"
                  defaultValue={text("monthlySalaryCents", profile?.monthlySalaryCents != null ? centsToInputValue(profile.monthlySalaryCents) : "")}
                  placeholder="45000"
                  aria-invalid={fieldErrors?.monthlySalaryCents ? true : undefined}
                />
              </div>
            </Field>
            <Field label="Years of experience" htmlFor="yearsExperience" errors={fieldErrors?.yearsExperience}>
              <Input {...ctl("yearsExperience")} type="number" min={0} defaultValue={text("yearsExperience", profile?.yearsExperience)} placeholder="e.g. 5" />
            </Field>
            <Field label="Joining date" htmlFor="joinedOn" errors={fieldErrors?.joinedOn}>
              <Input {...ctl("joinedOn")} type="date" defaultValue={text("joinedOn", profile?.joinedOn)} />
            </Field>
            <Field label="Role" htmlFor="jobRole" errors={fieldErrors?.jobRole}>
              <Select {...ctl("jobRole")} defaultValue={text("jobRole", profile?.jobRole)}>
                <option value="">Select role</option>
                {STAFF_JOB_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {STAFF_JOB_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Designation" htmlFor="title" hint="Shown under the name in the directory, e.g. Senior Stylist." errors={fieldErrors?.title}>
              <Input {...ctl("title")} defaultValue={text("title", profile?.title)} placeholder="e.g. Senior Stylist" />
            </Field>
            <Field label="Casual leaves" htmlFor="casualLeaves" hint="Allowance in days per year." errors={fieldErrors?.casualLeaves}>
              <Input {...ctl("casualLeaves")} type="number" min={0} defaultValue={text("casualLeaves", profile?.casualLeaves)} placeholder="Enter casual leave allowance" />
            </Field>
            {editing && (
              <Field label="Status" htmlFor="status" hint="On leave and inactive staff are not shown as available." errors={fieldErrors?.status}>
                <Select {...ctl("status")} defaultValue={text("status", profile?.status)}>
                  {STAFF_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STAFF_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <fieldset className="mt-8">
            <legend className="mb-1 flex w-full items-center justify-between gap-4 text-label-md text-on-surface-variant">
              Working hours
              <span className="text-label-sm font-medium text-secondary">Optional — availability is only shown once a shift is set</span>
            </legend>
            <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-3">
              <Field label="Weekly off" htmlFor="weeklyOff" errors={fieldErrors?.weeklyOff}>
                <Select {...ctl("weeklyOff")} defaultValue={text("weeklyOff", profile?.schedule.weeklyOffDay != null ? WEEKDAYS[profile.schedule.weeklyOffDay] : "")}>
                  <option value="">No fixed day off</option>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={d}>
                      {WEEKDAY_LABELS[i]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Check-in time" htmlFor="shiftStart" errors={fieldErrors?.shiftStart}>
                <Input {...ctl("shiftStart")} type="time" defaultValue={text("shiftStart", initialHours?.start)} />
              </Field>
              <Field label="Check-out time" htmlFor="shiftEnd" errors={fieldErrors?.shiftEnd}>
                <Input {...ctl("shiftEnd")} type="time" defaultValue={text("shiftEnd", initialHours?.end)} />
              </Field>
            </div>
            <p className="mt-2 text-label-sm text-secondary">The shift applies to every day except the weekly off.</p>
          </fieldset>

          <fieldset className="mt-8">
            <legend className="mb-3 text-label-md text-on-surface-variant">Breaks</legend>
            <ul className="flex flex-col gap-3">
              {breaks.map((b, i) => (
                <li key={b.key} className="grid grid-cols-[1fr_auto] items-end gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor={`breakLabel-${b.key}`} className="mb-1 block text-label-sm text-secondary">
                      Label
                    </label>
                    <Input
                      id={`breakLabel-${b.key}`}
                      name="breakLabel"
                      value={b.label}
                      maxLength={40}
                      placeholder="e.g. Lunch"
                      onChange={(e) => setBreaks((rows) => rows.map((r) => (r.key === b.key ? { ...r, label: e.target.value } : r)))}
                    />
                  </div>
                  <div>
                    <label htmlFor={`breakStart-${b.key}`} className="mb-1 block text-label-sm text-secondary">
                      From
                    </label>
                    <Input
                      id={`breakStart-${b.key}`}
                      name="breakStart"
                      type="time"
                      value={b.start}
                      aria-invalid={breakError(i) ? true : undefined}
                      onChange={(e) => setBreaks((rows) => rows.map((r) => (r.key === b.key ? { ...r, start: e.target.value } : r)))}
                    />
                  </div>
                  <div>
                    <label htmlFor={`breakEnd-${b.key}`} className="mb-1 block text-label-sm text-secondary">
                      To
                    </label>
                    <Input
                      id={`breakEnd-${b.key}`}
                      name="breakEnd"
                      type="time"
                      value={b.end}
                      aria-invalid={breakError(i) ? true : undefined}
                      onChange={(e) => setBreaks((rows) => rows.map((r) => (r.key === b.key ? { ...r, end: e.target.value } : r)))}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove break ${i + 1}`} onClick={() => setBreaks((rows) => rows.filter((r) => r.key !== b.key))}>
                    <Icon name="close" size={16} />
                  </Button>
                  {breakError(i) && (
                    <p role="alert" className="col-span-2 text-label-sm text-error sm:col-span-4">
                      {breakError(i)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {fieldErrors?.breaks && (
              <p role="alert" className="mt-2 text-label-sm text-error">
                {fieldErrors.breaks[0]}
              </p>
            )}
            {breaks.length < MAX_BREAKS && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon="plus"
                className="mt-3 -ml-3"
                onClick={() => {
                  setBreaks((rows) => [...rows, { key: nextKey, label: "", start: "", end: "" }]);
                  setNextKey((k) => k + 1);
                }}
              >
                Add break
              </Button>
            )}
          </fieldset>
        </Section>

        <Section
          icon="scissors"
          title="Services"
          description="Services this person performs, from their branch's offering. Leave empty to allow any service the branch offers."
        >
          <StaffServicePicker
            options={branchServices}
            value={chosenServiceIds}
            onChange={setServiceIds}
            currency={options.currency}
            disabled={readOnly}
            invalid={Boolean(fieldErrors?.serviceIds)}
            describedBy={fieldErrors?.serviceIds ? "serviceIds-error" : undefined}
          />
          {fieldErrors?.serviceIds && (
            <p role="alert" id="serviceIds-error" className="mt-2 text-label-sm text-error">
              {fieldErrors.serviceIds[0]}
            </p>
          )}
        </Section>
      </div>

      <div className="flex flex-col gap-6 lg:col-span-4">
        <Section icon="users" title="Reference Details">
          <Field label="Recruitment source" htmlFor="recruitmentSource" errors={fieldErrors?.recruitmentSource}>
            <Input {...ctl("recruitmentSource")} defaultValue={text("recruitmentSource", profile?.recruitmentSource)} placeholder="e.g. Referred by Michael Johnson" />
          </Field>
        </Section>

        <Card className="flex flex-col gap-4 lg:sticky lg:top-24">
          {readOnly && (
            <p role="note" className="rounded-control bg-surface-container-low px-4 py-3 text-body-sm text-secondary">
              Demo mode is read-only. Set DATABASE_URL to save staff.
            </p>
          )}
          <div ref={feedbackRef} tabIndex={-1} className="focus:outline-none" aria-live="polite">
            {(formLevelError || invalidCount > 0) && (
              <div role="alert" className="flex items-start gap-3 rounded-control border border-error/30 bg-error-container/60 px-4 py-3 text-body-sm text-on-error-container">
                <Icon name="close" size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{formLevelError ? "Couldn't save staff" : "Staff not saved yet"}</p>
                  <p>
                    {formLevelError ??
                      `${invalidCount} ${invalidCount === 1 ? "field needs" : "fields need"} attention. Your entries have been kept — fix the highlighted ${invalidCount === 1 ? "field" : "fields"} and try again.`}
                  </p>
                </div>
              </div>
            )}
          </div>
          <Button type="submit" variant="accent" fullWidth disabled={pending || readOnly} className="font-semibold">
            {pending ? "Saving…" : editing ? "Save changes" : "Add Staff"}
          </Button>
          <ButtonLink href="/staff" variant="secondary" fullWidth>
            Cancel
          </ButtonLink>
        </Card>
      </div>
    </form>
  );
}
