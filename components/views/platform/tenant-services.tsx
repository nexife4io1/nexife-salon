"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSection } from "@/components/ui/page-section";
import { TableShell } from "@/components/ui/table-shell";
import { pluralize } from "@/lib/format";
import { addTenantServicesAction } from "@/server/tenants/actions";
import type { ServiceTemplate, TenantService } from "@/server/tenants/schema";
import { fieldErrorsOf, FormError } from "./form-error";
import { buildServicesPayload, ServicePicker, serviceRowErrors, type PickerValue } from "./service-picker";
import { TenantServiceRow } from "./tenant-service-row";

function AddServicesPanel({ tenantId, currency, templates }: { tenantId: string; currency: string; templates: ServiceTemplate[] }) {
  const [picked, setPicked] = useState<PickerValue>({});
  const [state, formAction, pending] = useActionState(
    async (prev: Parameters<typeof addTenantServicesAction>[0], formData: FormData) => {
      const result = await addTenantServicesAction(prev, formData);
      if (result.ok) setPicked({});
      return result;
    },
    undefined,
  );
  const fe = fieldErrorsOf(state);
  const selectedCount = Object.keys(picked).length;

  return (
    <Card padding="lg">
      <CardHeader title="Add services" description="Templates this tenant doesn't offer yet. Adjust the price and duration for this tenant before adding." />
      {templates.length === 0 ? (
        <p className="text-body-sm text-secondary">Every active template is already associated with this tenant.</p>
      ) : (
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="services" value={JSON.stringify(buildServicesPayload(templates, picked))} />
          <ServicePicker
            idPrefix="add"
            templates={templates}
            value={picked}
            onChange={setPicked}
            currency={currency}
            errors={serviceRowErrors(templates, picked, fe)}
            disabled={pending}
          />
          {fe?.services && (
            <p role="alert" className="text-label-sm text-error">
              {fe.services[0]}
            </p>
          )}
          <FormError state={state} />
          <div className="flex justify-end border-t border-outline-variant/20 pt-6">
            <Button type="submit" icon="plus" disabled={pending || selectedCount === 0}>
              {pending ? "Adding…" : `Add ${pluralize(selectedCount, "service")}`}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/** Services association: the tenant's current services (inline edit) plus an "Add services" panel. */
export function TenantServices({
  tenantId,
  currency,
  services,
  availableTemplates,
}: {
  tenantId: string;
  currency: string;
  services: TenantService[];
  availableTemplates: ServiceTemplate[];
}) {
  return (
    <>
      <PageSection title="Services" description="What this tenant offers, with its own price and duration for each.">
        <TableShell
          columns={["Service", "Category", "For", "Duration", "Price", "Active", "Actions"]}
          empty={<EmptyState icon="scissors" title="No services yet" description="Add services from the catalog below." />}
        >
          {services.length > 0 &&
            services.map((service) => <TenantServiceRow key={service.id} tenantId={tenantId} currency={currency} service={service} />)}
        </TableShell>
      </PageSection>
      <PageSection>
        <AddServicesPanel tenantId={tenantId} currency={currency} templates={availableTemplates} />
      </PageSection>
    </>
  );
}
