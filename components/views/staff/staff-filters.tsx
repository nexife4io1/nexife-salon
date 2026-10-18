"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Select } from "@/components/ui/field";
import { SearchField } from "@/components/ui/search-field";
import { cn } from "@/lib/cn";
import { STAFF_STATUSES, STAFF_STATUS_LABELS, staffFiltersHref, type StaffBranchOption, type StaffFilters } from "@/server/staff/schema";

const SEARCH_DEBOUNCE_MS = 300;

/** Filters live in the URL (shareable); every change navigates immediately — no Apply button. */
export function StaffFilterBar({ filters, branches }: { filters: StaffFilters; branches: StaffBranchOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const active = Boolean(filters.q || filters.branchId || filters.status);

  // Keep the box in sync when the URL changes elsewhere (e.g. "Clear").
  const [urlQ, setUrlQ] = useState(filters.q);
  if (urlQ !== filters.q) {
    setUrlQ(filters.q);
    setQ(filters.q ?? "");
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (next: { q?: string; branchId?: string; status?: string }) => {
    clearTimeout(timer.current);
    startTransition(() => router.replace(staffFiltersHref({ q, branchId: filters.branchId, status: filters.status, ...next })));
  };

  return (
    <form
      role="search"
      aria-label="Filter staff"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        go({ q });
      }}
      className="mb-6 flex flex-col gap-3 rounded-card border border-outline-variant/15 bg-surface-container-lowest p-3 shadow-card md:flex-row md:items-center md:justify-between"
    >
      <SearchField
        name="q"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          clearTimeout(timer.current);
          const value = e.target.value;
          timer.current = setTimeout(() => go({ q: value }), SEARCH_DEBOUNCE_MS);
        }}
        placeholder="Search staff…"
        aria-label="Search staff by name or title"
        className="w-full md:w-80"
        maxLength={80}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={filters.branchId ?? ""} onChange={(e) => go({ branchId: e.target.value || undefined })} aria-label="Branch" className="h-10 sm:w-52">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <fieldset className="flex items-center gap-1 rounded-control bg-surface-container-low p-1">
          <legend className="sr-only">Status</legend>
          {[undefined, ...STAFF_STATUSES].map((status) => (
            <label key={status ?? "all"} className="cursor-pointer">
              <input
                type="radio"
                name="status"
                value={status ?? ""}
                checked={filters.status === status}
                onChange={() => go({ status })}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "block rounded-control px-3 py-1.5 text-label-md text-on-surface-variant transition-colors",
                  "peer-checked:bg-surface-container-lowest peer-checked:text-on-surface peer-checked:shadow-card peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container",
                )}
              >
                {status ? STAFF_STATUS_LABELS[status] : "All"}
              </span>
            </label>
          ))}
        </fieldset>
        {active && (
          <Link href="/staff" className="text-label-md text-primary hover:underline">
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
