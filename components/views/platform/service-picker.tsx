"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { centsToInputValue, formatMoney, parseMoneyToCents } from "@/lib/format";
import { AUDIENCE_LABELS } from "@/server/shared/audience";
import type { ServiceTemplate } from "@/server/tenants/schema";

/** What the admin has typed for each checked template (price as a decimal string, duration in minutes). */
export type PickerValue = Record<string, { price: string; duration: string }>;

/** Checked templates in catalog order — the same order used for the submitted JSON, so error indexes line up. */
function selectedTemplates(templates: ServiceTemplate[], value: PickerValue) {
  return templates.filter((t) => value[t.id]);
}

/** Payload for the hidden `services` field. Invalid numbers become null so the server reports them per row. */
export function buildServicesPayload(templates: ServiceTemplate[], value: PickerValue) {
  return selectedTemplates(templates, value).map((t) => {
    const entry = value[t.id]!;
    const duration = entry.duration.trim() === "" ? null : Number(entry.duration);
    return { templateId: t.id, priceCents: parseMoneyToCents(entry.price), durationMinutes: Number.isFinite(duration) ? duration : null };
  });
}

type RowErrors = Record<string, { price?: string; duration?: string; general?: string }>;

/** Map server `services.<index>.<field>` errors back onto template ids. */
export function serviceRowErrors(templates: ServiceTemplate[], value: PickerValue, fieldErrors?: Record<string, string[]>): RowErrors {
  const rows: RowErrors = {};
  selectedTemplates(templates, value).forEach((t, index) => {
    rows[t.id] = {
      price: fieldErrors?.[`services.${index}.priceCents`]?.[0],
      duration: fieldErrors?.[`services.${index}.durationMinutes`]?.[0],
      general: fieldErrors?.[`services.${index}.templateId`]?.[0],
    };
  });
  return rows;
}

export function ServicePicker({
  idPrefix,
  templates,
  value,
  onChange,
  currency,
  errors,
  disabled,
}: {
  idPrefix: string;
  templates: ServiceTemplate[];
  value: PickerValue;
  onChange: (next: PickerValue) => void;
  currency: string;
  errors?: RowErrors;
  disabled?: boolean;
}) {
  function toggle(template: ServiceTemplate, checked: boolean) {
    if (!checked) {
      const { [template.id]: _removed, ...rest } = value;
      onChange(rest);
      return;
    }
    onChange({
      ...value,
      [template.id]: { price: centsToInputValue(template.defaultPriceCents), duration: String(template.defaultDurationMinutes) },
    });
  }

  function edit(templateId: string, field: "price" | "duration", text: string) {
    onChange({ ...value, [templateId]: { ...value[templateId]!, [field]: text } });
  }

  return (
    <ul className="space-y-3">
      {templates.map((template) => {
        const entry = value[template.id];
        const rowErrors = errors?.[template.id];
        return (
          <li key={template.id} className="rounded-control bg-surface-container-low px-4 py-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={Boolean(entry)}
                disabled={disabled}
                onChange={(e) => toggle(template, e.target.checked)}
              />
              <span className="flex-1 text-body-sm font-semibold text-on-surface">{template.name}</span>
              {template.category && <Badge tone="neutral">{template.category}</Badge>}
              <Badge tone={template.audience === "kids" ? "gold" : "neutral"}>{AUDIENCE_LABELS[template.audience]}</Badge>
              <span className="text-label-sm text-secondary">
                {formatMoney(template.defaultPriceCents, currency)} · {template.defaultDurationMinutes} min
              </span>
            </label>

            {entry && (
              <div className="mt-3 grid gap-4 pl-7 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor={`${idPrefix}-${template.id}-price`} className="text-label-md text-on-surface-variant">
                    Price ({currency})
                  </label>
                  <Input
                    id={`${idPrefix}-${template.id}-price`}
                    inputMode="decimal"
                    value={entry.price}
                    onChange={(e) => edit(template.id, "price", e.target.value)}
                    aria-invalid={rowErrors?.price ? true : undefined}
                  />
                  {rowErrors?.price && <p className="text-label-sm text-error">{rowErrors.price}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor={`${idPrefix}-${template.id}-duration`} className="text-label-md text-on-surface-variant">
                    Duration (minutes)
                  </label>
                  <Input
                    id={`${idPrefix}-${template.id}-duration`}
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    value={entry.duration}
                    onChange={(e) => edit(template.id, "duration", e.target.value)}
                    aria-invalid={rowErrors?.duration ? true : undefined}
                  />
                  {rowErrors?.duration && <p className="text-label-sm text-error">{rowErrors.duration}</p>}
                </div>
                {rowErrors?.general && <p className="text-label-sm text-error sm:col-span-2">{rowErrors.general}</p>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
