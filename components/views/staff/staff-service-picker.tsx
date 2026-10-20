"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatMoney } from "@/lib/format";
import type { StaffServiceOption } from "@/server/staff/schema";

/**
 * Search-and-pick list of the services a staff member performs. Controlled; every selected id is posted as a
 * `serviceIds` form value (also while filtered out of view), so it works inside any <form>.
 */
export function StaffServicePicker({
  options,
  value,
  onChange,
  currency,
  disabled,
  invalid,
  describedBy,
}: {
  options: StaffServiceOption[];
  value: string[];
  onChange: (next: string[]) => void;
  currency: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => o.name.toLowerCase().includes(q) || (o.category ?? "").toLowerCase().includes(q)) : options;
  const selected = new Set(value);

  const toggle = (id: string, checked: boolean) => onChange(options.map((o) => o.id).filter((optionId) => (optionId === id ? checked : selected.has(optionId))));

  return (
    <div>
      {options.filter((o) => selected.has(o.id)).map((o) => (
        <input key={o.id} type="hidden" name="serviceIds" value={o.id} />
      ))}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Input
          type="search"
          aria-label="Search services"
          placeholder="Search services"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          className="md:max-w-xs"
          disabled={disabled || !options.length}
        />
        <div className="flex items-center gap-1">
          <span className="text-label-sm text-secondary">
            {selected.size} of {options.length} selected
          </span>
          <Button type="button" variant="ghost" size="sm" disabled={disabled || !visible.length} onClick={() => onChange([...new Set([...value, ...visible.map((o) => o.id)])])}>
            Select shown
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled || !selected.size} onClick={() => onChange([])}>
            Clear
          </Button>
        </div>
      </div>
      {visible.length ? (
        <ul className="grid max-h-72 gap-2 overflow-y-auto md:grid-cols-2">
          {visible.map((option) => (
            <li key={option.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-control bg-surface-container-low px-4 py-3">
                <input
                  type="checkbox"
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
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-control bg-surface-container-low p-4 text-body-sm text-secondary">
          {options.length ? "No services match your search." : "Choose a branch that offers services to assign them."}
        </p>
      )}
    </div>
  );
}
