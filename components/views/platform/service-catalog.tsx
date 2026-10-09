"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { TableShell } from "@/components/ui/table-shell";
import { centsToInputValue } from "@/lib/format";
import { AUDIENCE_LABELS, SERVICE_AUDIENCES } from "@/server/shared/audience";
import {
  createServiceTemplateAction,
  toggleServiceTemplateAction,
  updateServiceTemplateAction,
} from "@/server/tenants/actions";
import type { ServiceTemplate } from "@/server/tenants/schema";
import { ActiveSwitch } from "./active-switch";
import { fieldErrorsOf, FormError } from "./form-error";
import { MoneyInput } from "./money-input";

function TemplateActiveSwitch({ template }: { template: ServiceTemplate }) {
  const [, action, pending] = useActionState(toggleServiceTemplateAction, undefined);
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={template.id} />
      <input type="hidden" name="active" value={String(!template.active)} />
      <ActiveSwitch active={template.active} pending={pending} label={`${template.name} is ${template.active ? "active" : "inactive"}`} />
      <Badge tone={template.active ? "success" : "neutral"}>{template.active ? "Active" : "Inactive"}</Badge>
    </form>
  );
}

function TemplateForm({ template, onDone, onCancel }: { template: ServiceTemplate | null; onDone: () => void; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (prev: Parameters<typeof createServiceTemplateAction>[0], formData: FormData) => {
      const result = await (template ? updateServiceTemplateAction : createServiceTemplateAction)(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    undefined,
  );
  const fe = fieldErrorsOf(state);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Dispatch by hand: <form action> would clear the fields after a validation error.
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      {template && <input type="hidden" name="id" value={template.id} />}
      <Field label="Service name" htmlFor="template-name" errors={fe?.name}>
        <Input id="template-name" name="name" defaultValue={template?.name} placeholder="e.g. Signature Cut & Style" required />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Category" htmlFor="template-category" errors={fe?.category}>
          <Input id="template-category" name="category" defaultValue={template?.category ?? ""} placeholder="e.g. Hair" />
        </Field>
        <Field label="For" htmlFor="template-audience" hint="Who the service is for." errors={fe?.audience}>
          <Select id="template-audience" name="audience" defaultValue={template?.audience ?? "unisex"}>
            {SERVICE_AUDIENCES.map((audience) => (
              <option key={audience} value={audience}>
                {AUDIENCE_LABELS[audience]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Default price" htmlFor="template-price" hint="In the tenant's own currency." errors={fe?.defaultPriceCents}>
          <MoneyInput id="template-price" name="defaultPriceCents" defaultCents={template?.defaultPriceCents} />
        </Field>
        <Field label="Default duration (min)" htmlFor="template-duration" errors={fe?.defaultDurationMinutes}>
          <Input
            id="template-duration"
            name="defaultDurationMinutes"
            type="number"
            min={5}
            max={600}
            step={5}
            defaultValue={template?.defaultDurationMinutes ?? 30}
          />
        </Field>
      </div>
      <FormError state={state} />
      <div className="flex items-center justify-end gap-3 border-t border-outline-variant/20 pt-6">
        {template && (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" icon={template ? undefined : "plus"} disabled={pending}>
          {pending ? "Saving…" : template ? "Save changes" : "Create template"}
        </Button>
      </div>
    </form>
  );
}

/** Master service catalog: every template Nexife offers to tenants, plus the create/edit form. */
export function ServiceCatalog({ templates, readOnlyNote }: { templates: ServiceTemplate[]; readOnlyNote?: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // Bumping the key remounts the form with fresh fields after a successful save.
  const [nonce, setNonce] = useState(0);
  const editing = templates.find((t) => t.id === editingId) ?? null;

  return (
    <div className="grid items-start gap-gutter lg:grid-cols-3">
      <div className="lg:col-span-2">
        <TableShell
          columns={["Service", "Category", "For", "Duration", "Default price", "Status", "Actions"]}
          empty={<EmptyState icon="scissors" title="No templates yet" description="Create the first service template with the form." />}
        >
          {templates.length > 0 &&
            templates.map((template) => (
              <tr key={template.id}>
                <td className="px-6 py-4 font-semibold text-on-surface">{template.name}</td>
                <td className="px-6 py-4 text-secondary">{template.category ?? "—"}</td>
                <td className="px-6 py-4">
                  <Badge tone={template.audience === "kids" ? "gold" : "neutral"}>{AUDIENCE_LABELS[template.audience]}</Badge>
                </td>
                <td className="px-6 py-4">{template.defaultDurationMinutes} min</td>
                <td className="px-6 py-4">{centsToInputValue(template.defaultPriceCents)}</td>
                <td className="px-6 py-4">
                  <TemplateActiveSwitch template={template} />
                </td>
                <td className="px-6 py-4">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(template.id)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
        </TableShell>
      </div>

      <Card padding="lg">
        <CardHeader title={editing ? `Edit ${editing.name}` : "New service template"} description={readOnlyNote} />
        <TemplateForm
          key={`${editing?.id ?? "new"}-${nonce}`}
          template={editing}
          onDone={() => {
            setEditingId(null);
            setNonce((n) => n + 1);
          }}
          onCancel={() => setEditingId(null)}
        />
      </Card>
    </div>
  );
}
