"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PageSection } from "@/components/ui/page-section";
import { AUDIENCE_LABELS } from "@/server/shared/audience";
import { onboardTenantAction } from "@/server/tenants/actions";
import type { ServiceTemplate } from "@/server/tenants/schema";
import { fieldErrorsOf, FormError } from "./form-error";
import { buildServicesPayload, ServicePicker, serviceRowErrors, type PickerValue } from "./service-picker";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function OnboardTenantForm({
  templates,
  currencies,
  timezones,
}: {
  templates: ServiceTemplate[];
  currencies: readonly string[];
  timezones: readonly string[];
}) {
  const [state, formAction, pending] = useActionState(onboardTenantAction, undefined);
  const fe = fieldErrorsOf(state);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [picked, setPicked] = useState<PickerValue>({});
  // The first branch offers every picked service unless the admin unticks it here.
  const [notOffered, setNotOffered] = useState<Set<string>>(new Set());
  const pickedTemplates = templates.filter((t) => picked[t.id]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("services", JSON.stringify(buildServicesPayload(templates, picked)));
    data.set("branch.offeredTemplateIds", JSON.stringify(pickedTemplates.filter((t) => !notOffered.has(t.id)).map((t) => t.id)));
    // Calling the action directly (not via <form action>) keeps typed values after a validation error.
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-4xl">
      <PageSection title="Tenant" description="The salon business and its regional settings.">
        <Card padding="lg" className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Business name" htmlFor="tenant-name" errors={fe?.["tenant.name"]}>
              <Input
                id="tenant-name"
                name="tenant.name"
                placeholder="e.g. Meridian Salon"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
                required
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Slug" htmlFor="tenant-slug" hint="Lowercase letters, numbers and hyphens. Must be unique." errors={fe?.["tenant.slug"]}>
              <Input
                id="tenant-slug"
                name="tenant.slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                }}
                required
              />
            </Field>
          </div>
          <Field label="Currency" htmlFor="tenant-currency" errors={fe?.["tenant.currency"]}>
            <Select id="tenant-currency" name="tenant.currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Timezone" htmlFor="tenant-timezone" errors={fe?.["tenant.timezone"]}>
            <Select id="tenant-timezone" name="tenant.timezone" defaultValue="UTC">
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
        </Card>
      </PageSection>

      <PageSection title="First owner" description="Creates the owner account the tenant signs in with." className="mt-10">
        <Card padding="lg" className="grid gap-6 md:grid-cols-2">
          <Field label="Full name" htmlFor="owner-name" errors={fe?.["owner.name"]}>
            <Input id="owner-name" name="owner.name" autoComplete="off" required />
          </Field>
          <Field label="Username" htmlFor="owner-username" errors={fe?.["owner.username"]}>
            <Input id="owner-username" name="owner.username" autoComplete="off" autoCapitalize="none" required />
          </Field>
          <Field label="Password" htmlFor="owner-password" hint="At least 10 characters." errors={fe?.["owner.password"]}>
            <Input id="owner-password" name="owner.password" type="password" autoComplete="new-password" required />
          </Field>
          <Field label="Confirm password" htmlFor="owner-confirm" errors={fe?.["owner.confirmPassword"]}>
            <Input id="owner-confirm" name="owner.confirmPassword" type="password" autoComplete="new-password" required />
          </Field>
        </Card>
      </PageSection>

      <PageSection title="First branch" description="The tenant's first location. More can be added by the owner later." className="mt-10">
        <Card padding="lg" className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Branch name" htmlFor="branch-name" errors={fe?.["branch.name"]}>
              <Input id="branch-name" name="branch.name" placeholder="e.g. Downtown Flagship" required />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Street address" htmlFor="branch-address" errors={fe?.["branch.addressLine"]}>
              <Input id="branch-address" name="branch.addressLine" required />
            </Field>
          </div>
          <Field label="City" htmlFor="branch-city" errors={fe?.["branch.city"]}>
            <Input id="branch-city" name="branch.city" />
          </Field>
          <Field label="Phone" htmlFor="branch-phone" errors={fe?.["branch.phone"]}>
            <Input id="branch-phone" name="branch.phone" type="tel" />
          </Field>
          <div className="md:col-span-2">
            <p className="mb-1 text-label-md text-on-surface-variant">Services offered at this branch</p>
            {pickedTemplates.length === 0 ? (
              <p className="text-label-sm text-secondary">Pick services in the next section, then choose which ones this branch offers.</p>
            ) : (
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {pickedTemplates.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-control bg-surface-container-low px-4 py-3">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={!notOffered.has(t.id)}
                        disabled={pending}
                        onChange={(e) =>
                          setNotOffered((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.delete(t.id);
                            else next.add(t.id);
                            return next;
                          })
                        }
                      />
                      <span className="flex-1 text-body-sm font-semibold text-on-surface">{t.name}</span>
                      <Badge tone={t.audience === "kids" ? "gold" : "neutral"}>{AUDIENCE_LABELS[t.audience]}</Badge>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {fe?.["branch.offeredTemplateIds"] && <p className="mt-2 text-label-sm text-error">{fe["branch.offeredTemplateIds"][0]}</p>}
          </div>
        </Card>
      </PageSection>

      <PageSection
        title="Services"
        description="Pick from the platform catalog. Prices and durations start at the template defaults and can be adjusted per tenant."
        className="mt-10"
      >
        <Card padding="lg">
          {templates.length === 0 ? (
            <p className="text-body-sm text-secondary">The service catalog is empty. Add templates under Service Catalog first.</p>
          ) : (
            <ServicePicker
              idPrefix="onboard"
              templates={templates}
              value={picked}
              onChange={setPicked}
              currency={currency}
              errors={serviceRowErrors(templates, picked, fe)}
              disabled={pending}
            />
          )}
          {fe?.services && (
            <p role="alert" className="mt-4 text-label-sm text-error">
              {fe.services[0]}
            </p>
          )}
        </Card>
      </PageSection>

      <div className="mt-8 space-y-4">
        <FormError state={state} />
        <div className="flex items-center justify-end gap-3 border-t border-outline-variant/20 pt-6">
          <ButtonLink href="/platform" variant="ghost">
            Cancel
          </ButtonLink>
          <Button type="submit" icon="plus" disabled={pending}>
            {pending ? "Onboarding…" : "Onboard Tenant"}
          </Button>
        </div>
      </div>
    </form>
  );
}
