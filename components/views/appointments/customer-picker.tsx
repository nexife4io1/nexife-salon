"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/field";
import { searchCustomersAction } from "@/server/appointments/actions";
import type { CustomerChoice } from "@/server/appointments/schema";

const SEARCH_DELAY_MS = 250;

const digits = (value: string) => value.replace(/\D/g, "");
const matches = (c: CustomerChoice, q: string) => {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const qd = digits(needle);
  return c.name.toLowerCase().includes(needle) || (qd.length > 0 && digits(c.phone ?? "").includes(qd));
};

/**
 * One control for choosing a customer: type a name or phone number and pick a result, in the same field.
 *
 * - Pattern: ARIA 1.2 combobox with a listbox popup (focus stays in the input; the highlighted option is
 *   `aria-activedescendant`). Arrow keys move, Enter picks, Escape closes, Home/End jump.
 * - The chosen customer replaces the field with a summary (name and phone) and a Change button, so who is selected is
 *   never ambiguous. The value that is submitted is the hidden `customerId` input.
 * - `initial` is only a starting list. When `truncated` is true the directory is larger than that list, so typing
 *   searches the server (`searchCustomersAction`), which covers every customer; otherwise it filters locally.
 */
export function CustomerPicker({
  value,
  selected,
  initial,
  truncated,
  onChange,
  invalid,
  optional,
  readOnly,
  name = "customerId",
  id = "customerId",
}: {
  value: string;
  /** The chosen customer, so the summary can show them even when they are not in `initial`. */
  selected: CustomerChoice | undefined;
  initial: CustomerChoice[];
  truncated: boolean;
  onChange: (customer: CustomerChoice | undefined) => void;
  invalid?: boolean;
  /** Walk-ins may have no customer on file. */
  optional?: boolean;
  readOnly?: boolean;
  name?: string;
  id?: string;
}) {
  const listId = useId();
  const statusId = useId();
  // The shared Input / Button primitives do not forward refs, so find the control inside our own root element.
  const rootRef = useRef<HTMLDivElement>(null);
  const focusControl = (selector: string) => rootRef.current?.querySelector<HTMLElement>(selector)?.focus();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<{ query: string; results: CustomerChoice[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const focusAfterClear = useRef(false);

  const q = query.trim();
  // Server results apply only to the query they were fetched for; until they arrive, show what we already have.
  const remoteFresh = truncated && q && remote?.query === q;
  const results = remoteFresh ? remote.results : initial.filter((c) => matches(c, q));
  const searching = Boolean(truncated && q && !remoteFresh && !failed);

  useEffect(() => {
    if (!truncated || !q) return;
    let stale = false;
    const timer = setTimeout(() => {
      searchCustomersAction(q)
        .then((found) => {
          if (stale) return;
          setFailed(false);
          setRemote({ query: q, results: found });
        })
        .catch(() => !stale && setFailed(true));
    }, SEARCH_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q, truncated]);

  // After "Change", the summary is gone and the input has just mounted: put the cursor in it.
  useEffect(() => {
    if (!value && focusAfterClear.current) {
      focusAfterClear.current = false;
      focusControl("input[role=combobox]");
      setOpen(true);
    }
  }, [value]);

  const optionId = (index: number) => `${listId}-${index}`;
  const choose = (customer: CustomerChoice) => {
    onChange(customer);
    setQuery("");
    setOpen(false);
    setActive(0);
    // The summary replaces the input; keep keyboard users in the control.
    requestAnimationFrame(() => focusControl("button[data-change]"));
  };
  const clear = () => {
    focusAfterClear.current = true;
    setQuery("");
    setActive(0);
    onChange(undefined);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        else setActive((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) setOpen(true);
        else setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        if (open && results.length) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open && results.length) {
          event.preventDefault();
          setActive(results.length - 1);
        }
        break;
      case "Enter":
        // Never submit the booking from inside the picker.
        if (open) {
          event.preventDefault();
          const pick = results[active];
          if (pick) choose(pick);
        }
        break;
      case "Escape":
        if (open || query) {
          event.preventDefault();
          setOpen(false);
          setQuery("");
        }
        break;
    }
  };

  const status = !open
    ? ""
    : searching
      ? "Searching customers…"
      : failed
        ? "Search is unavailable right now."
        : results.length
          ? `${results.length} ${results.length === 1 ? "customer" : "customers"} found. Use the up and down arrow keys, then Enter to choose.`
          : "No matching customers.";

  if (selected && value) {
    return (
      <div ref={rootRef} className="flex items-center justify-between gap-3 rounded-control bg-surface-container-low px-3 py-2">
        <input type="hidden" name={name} value={value} />
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={selected.name} />
          <div className="min-w-0">
            <p className="truncate text-body-md font-medium text-on-surface">{selected.name}</p>
            <p className="truncate text-label-sm text-secondary">{selected.phone ?? "No phone on file"}</p>
          </div>
        </div>
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            <Button data-change="" id={id} type="button" variant="ghost" size="sm" className="px-2" onClick={clear} aria-label={`Change customer, currently ${selected.name}`}>
              Change
            </Button>
            {optional && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-2"
                onClick={() => {
                  onChange(undefined);
                  setQuery("");
                }}
                aria-label="Remove customer (walk-in)"
              >
                <Icon name="close" size={16} />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value="" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? optionId(active) : undefined}
        aria-describedby={`${statusId}${invalid ? ` ${id}-error` : ""}`}
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={optional ? "Walk-in — or search by name or phone" : "Search by name or phone"}
        value={query}
        disabled={readOnly}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Customers"
        hidden={!open}
        className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-control border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-raised"
      >
        {results.map((customer, index) => (
          <li
            key={customer.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            // mousedown (not click) so the input keeps focus and its blur handler does not close the list first.
            onMouseDown={(event) => {
              event.preventDefault();
              choose(customer);
            }}
            onMouseMove={() => setActive(index)}
            className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-body-sm ${index === active ? "bg-primary-fixed/40 text-on-surface" : "text-on-surface"}`}
          >
            <span className="truncate font-medium">{customer.name}</span>
            <span className="shrink-0 text-label-sm text-secondary">{customer.phone ?? ""}</span>
          </li>
        ))}
        {!results.length && (
          <li role="presentation" className="px-4 py-3 text-body-sm text-secondary">
            {searching ? "Searching…" : failed ? "Search is unavailable right now." : q ? "No matching customers." : "No customers yet."}
          </li>
        )}
      </ul>
      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
