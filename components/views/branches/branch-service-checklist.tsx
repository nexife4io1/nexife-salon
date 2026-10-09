"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { AUDIENCE_LABELS } from "@/server/shared/audience";
import type { SalonService } from "@/server/staff/schema";

/**
 * Checklist of the services a branch offers. Controlled; each checked row submits as a
 * `serviceIds` form value, so it works inside any <form>.
 */
export function BranchServiceChecklist({
  options,
  value,
  onChange,
  currency,
  disabled,
}: {
  options: SalonService[];
  value: string[];
  onChange: (next: string[]) => void;
  currency: string;
  disabled?: boolean;
}) {
  if (options.length === 0) {
    return <p className="text-body-sm text-secondary">No active services yet. Services are added by your Nexife administrator.</p>;
  }

  const selected = new Set(value);
  const toggle = (id: string, checked: boolean) => onChange(options.map((o) => o.id).filter((optionId) => (optionId === id ? checked : selected.has(optionId))));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-label-sm text-secondary">
          {selected.size} of {options.length} offered
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(options.map((o) => o.id))}>
            Select all
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([])}>
            Clear
          </Button>
        </div>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {options.map((option) => (
          <li key={option.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-control bg-surface-container-low px-4 py-3">
              <input
                type="checkbox"
                name="serviceIds"
                value={option.id}
                className="size-4 accent-primary"
                checked={selected.has(option.id)}
                disabled={disabled}
                onChange={(e) => toggle(option.id, e.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-semibold text-on-surface">{option.name}</span>
                <span className="block text-label-sm text-secondary">
                  {option.category ? `${option.category} · ` : ""}
                  {option.durationMinutes} min · {formatMoney(option.priceCents, currency)}
                </span>
              </span>
              <Badge tone={option.audience === "kids" ? "gold" : "neutral"}>{AUDIENCE_LABELS[option.audience]}</Badge>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
