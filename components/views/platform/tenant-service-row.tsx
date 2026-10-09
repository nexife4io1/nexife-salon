"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatMoney } from "@/lib/format";
import { AUDIENCE_LABELS } from "@/server/shared/audience";
import { updateTenantServiceAction } from "@/server/tenants/actions";
import type { TenantService } from "@/server/tenants/schema";
import { ActiveSwitch } from "./active-switch";
import { fieldErrorsOf } from "./form-error";
import { MoneyInput } from "./money-input";

function firstError(state: Parameters<typeof fieldErrorsOf>[0]): string | null {
  if (!state || state.ok) return null;
  return Object.values(fieldErrorsOf(state) ?? {})[0]?.[0] ?? state.error.message;
}

/** One row of the tenant's service association table, with inline edit and an active toggle. */
export function TenantServiceRow({ tenantId, currency, service }: { tenantId: string; currency: string; service: TenantService }) {
  const formId = useId();
  const [editing, setEditing] = useState(false);

  const [editState, editAction, editPending] = useActionState(
    async (prev: Parameters<typeof updateTenantServiceAction>[0], formData: FormData) => {
      const result = await updateTenantServiceAction(prev, formData);
      if (result.ok) setEditing(false);
      return result;
    },
    undefined,
  );
  const [toggleState, toggleAction, togglePending] = useActionState(updateTenantServiceAction, undefined);
  const error = firstError(editState) ?? firstError(toggleState);

  return (
    <tr>
      <td className="px-6 py-4">
        <span className="font-semibold text-on-surface">{service.name}</span>
        {!service.templateId && (
          <Badge tone="neutral" className="ml-2">
            Custom
          </Badge>
        )}
      </td>
      <td className="px-6 py-4 text-secondary">{service.category ?? "—"}</td>
      <td className="px-6 py-4">
        <Badge tone={service.audience === "kids" ? "gold" : "neutral"}>{AUDIENCE_LABELS[service.audience]}</Badge>
      </td>
      <td className="px-6 py-4">
        {editing ? (
          <Input
            form={formId}
            name="durationMinutes"
            type="number"
            min={5}
            max={600}
            step={5}
            defaultValue={service.durationMinutes}
            aria-label={`Duration in minutes for ${service.name}`}
            className="w-28"
          />
        ) : (
          `${service.durationMinutes} min`
        )}
      </td>
      <td className="px-6 py-4">
        {editing ? (
          <MoneyInput
            id={`${formId}-price`}
            form={formId}
            name="priceCents"
            defaultCents={service.priceCents}
            aria-label={`Price for ${service.name}`}
            className="w-32"
          />
        ) : (
          formatMoney(service.priceCents, currency)
        )}
      </td>
      <td className="px-6 py-4">
        <form action={toggleAction}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="priceCents" value={service.priceCents} />
          <input type="hidden" name="durationMinutes" value={service.durationMinutes} />
          <input type="hidden" name="active" value={String(!service.active)} />
          <ActiveSwitch active={service.active} pending={togglePending} label={`${service.name} is ${service.active ? "active" : "inactive"}`} />
        </form>
      </td>
      <td className="px-6 py-4">
        <form
          id={formId}
          onSubmit={(e) => {
            // Dispatch the action by hand: <form action> would reset the inputs after a validation error.
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(() => editAction(data));
          }}
          className="flex items-center justify-end gap-2"
        >
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="active" value={String(service.active)} />
          {editing ? (
            <>
              <Button type="submit" size="sm" disabled={editPending}>
                {editPending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={editPending}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </form>
        {error && (
          <p role="alert" className="mt-2 text-right text-label-sm text-error">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}
