"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { addDaysToDateString } from "@/lib/dates";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  UPCOMING_STATUSES,
  appointmentsHref,
  type AppointmentBoard,
  type AppointmentFilters,
} from "@/server/appointments/schema";
import { formatDay } from "./format";

/** Upcoming first (the default), then each status, then everything. */
const STATUS_OPTIONS = ["upcoming", ...APPOINTMENT_STATUSES, "all"] as const;

const navButton = "grid size-10 place-items-center rounded-full text-secondary transition-colors hover:bg-surface-container-high hover:text-on-surface";

/** Date, branch and status filters. They live in the URL (shareable, back-button friendly) and apply immediately. */
export function AppointmentsFilterBar({ board }: { board: Pick<AppointmentBoard, "date" | "today" | "filters" | "branches" | "counts"> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { date, today, filters, branches, counts } = board;

  const href = (next: Partial<AppointmentFilters>) => {
    const merged = { ...filters, ...next };
    return appointmentsHref({ ...merged, date: merged.date === today ? undefined : merged.date });
  };
  const go = (next: Partial<AppointmentFilters>) => startTransition(() => router.replace(href(next)));
  const total = APPOINTMENT_STATUSES.reduce((sum, s) => sum + counts[s], 0);
  const upcomingCount = UPCOMING_STATUSES.reduce((sum, s) => sum + counts[s], 0);
  const heading = date === today ? "Today" : date === addDaysToDateString(today, 1) ? "Tomorrow" : date === addDaysToDateString(today, -1) ? "Yesterday" : null;

  return (
    <section aria-label="Filter appointments" aria-busy={pending} className="mb-6 space-y-4">
      <div className="flex flex-col gap-4 rounded-card border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-card md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Link href={href({ date: addDaysToDateString(date, -1) })} replace className={navButton} aria-label="Previous day">
            <Icon name="arrow-left" size={18} />
          </Link>
          <label className="relative flex cursor-pointer items-center gap-2 rounded-control px-2 py-1 hover:bg-surface-container-low">
            <Icon name="calendar" size={20} className="text-primary" />
            <span className="font-headline text-headline-sm font-semibold text-on-surface">
              {heading ? `${heading}, ` : ""}
              {formatDay(date)}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && go({ date: e.target.value })}
              aria-label="Choose date"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <Link href={href({ date: addDaysToDateString(date, 1) })} replace className={navButton} aria-label="Next day">
            <Icon name="arrow-right" size={18} />
          </Link>
          {date !== today && (
            <Link href={href({ date: today })} replace className="ml-1 text-label-md text-primary hover:underline">
              Today
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-label-sm text-secondary">
          <span className="text-label-md text-on-surface">{total === 1 ? "1 appointment" : `${total} appointments`}</span>
          <span>Waiting ({counts.checked_in})</span>
          <span>In service ({counts.in_service})</span>
          <Link href={href({ status: "completed" })} replace className="text-primary hover:underline">
            Completed ({counts.completed})
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <fieldset className="flex flex-wrap items-center gap-1 rounded-control bg-surface-container-low p-1">
          <legend className="sr-only">Status</legend>
          {STATUS_OPTIONS.map((status) => (
            <label key={status} className="cursor-pointer">
              <input
                type="radio"
                name="status"
                value={status}
                checked={(filters.status ?? "upcoming") === status}
                onChange={() => go({ status: status === "upcoming" ? undefined : status })}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "block rounded-control px-3 py-1.5 text-label-md text-on-surface-variant transition-colors",
                  "peer-checked:bg-surface-container-lowest peer-checked:text-on-surface peer-checked:shadow-card peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container",
                )}
              >
                {status === "all" ? `All (${total})` : status === "upcoming" ? `Upcoming (${upcomingCount})` : `${APPOINTMENT_STATUS_LABELS[status]} (${counts[status]})`}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex items-center gap-3">
          <Select value={filters.branchId ?? ""} onChange={(e) => go({ branchId: e.target.value || undefined })} aria-label="Branch" className="h-10 md:w-56">
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          {(filters.branchId || filters.status) && (
            <Link href={href({ branchId: undefined, status: undefined })} replace className="text-label-md text-primary hover:underline">
              Clear
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
