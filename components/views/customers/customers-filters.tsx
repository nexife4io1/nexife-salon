"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Select } from "@/components/ui/field";
import { SearchField } from "@/components/ui/search-field";
import { CUSTOMER_SORTS, CUSTOMER_SORT_LABELS, customersHref, type CustomerFilters } from "@/server/customers/schema";

const SEARCH_DEBOUNCE_MS = 300;

/** Filters live in the URL (shareable); every change navigates immediately and resets to page 1. */
export function CustomersFilterBar({ filters }: { filters: CustomerFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keep the box in sync when the URL changes elsewhere (e.g. "Clear").
  const [urlQ, setUrlQ] = useState(filters.q);
  if (urlQ !== filters.q) {
    setUrlQ(filters.q);
    setQ(filters.q ?? "");
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (next: { q?: string; sort?: string }) => {
    clearTimeout(timer.current);
    startTransition(() => router.replace(customersHref({ q, sort: filters.sort, ...next })));
  };

  return (
    <form
      role="search"
      aria-label="Filter customers"
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
        placeholder="Search customers…"
        aria-label="Search customers by name, phone or email"
        className="w-full md:w-80"
        maxLength={80}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={filters.sort} onChange={(e) => go({ sort: e.target.value })} aria-label="Sort by" className="h-10 sm:w-52">
          {CUSTOMER_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {CUSTOMER_SORT_LABELS[sort]}
            </option>
          ))}
        </Select>
        {(filters.q || filters.sort !== "recent") && (
          <Link href="/customers" className="text-label-md text-primary hover:underline">
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
