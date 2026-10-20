import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { pluralize } from "@/lib/format";
import type { Appointment, AppointmentBoard } from "@/server/appointments/schema";
import { AppointmentCard, type CardBilling } from "./appointment-card";
import { formatDay } from "./format";

type Column = { key: string; staffId: string | null; name: string; title: string | null; branchId: string | null; appointments: Appointment[] };

function bookHref(board: AppointmentBoard, staffId: string | null, branchId: string | null) {
  const params = new URLSearchParams({ date: board.date });
  const branch = board.filters.branchId ?? branchId;
  if (branch) params.set("branchId", branch);
  if (staffId) params.set("staffId", staffId);
  return `/appointments/new?${params}`;
}

/** One column per team member (like the salon floor), plus an "Unassigned" column when needed. */
function buildColumns(board: AppointmentBoard): Column[] {
  const byStaff = new Map<string, Appointment[]>();
  const unassigned: Appointment[] = [];
  for (const a of board.appointments) {
    if (!a.staffId) unassigned.push(a);
    else byStaff.set(a.staffId, [...(byStaff.get(a.staffId) ?? []), a]);
  }
  const known = new Set(board.staff.map((s) => s.id));
  const columns: Column[] = board.staff.map((s) => ({ key: s.id, staffId: s.id, name: s.name, title: s.title, branchId: s.branchId, appointments: byStaff.get(s.id) ?? [] }));
  // Staff who are no longer listed as active still own their appointments.
  for (const [staffId, appointments] of byStaff) {
    if (!known.has(staffId)) columns.push({ key: staffId, staffId, name: appointments[0]!.staffName ?? "Former team member", title: null, branchId: null, appointments });
  }
  if (unassigned.length) columns.push({ key: "unassigned", staffId: null, name: "Unassigned", title: "No team member yet", branchId: null, appointments: unassigned });
  return columns;
}

/** `receipts` maps appointment id to receipt id for the paid ones; `canCheckout` is false for roles without billing. */
export function AppointmentsBoard({ board, currency, canCheckout, receipts }: { board: AppointmentBoard; currency: string; canCheckout: boolean; receipts: Record<string, string> }) {
  const readOnly = board.source === "demo";
  // "Upcoming" (no status) and "all" show a whole day's worth; a specific status is a narrowing filter.
  const statusFiltered = Boolean(board.filters.status && board.filters.status !== "all");
  const filtered = statusFiltered || Boolean(board.filters.branchId);
  const upcoming = !board.filters.status;
  const columns = buildColumns(board);
  const branchNames = new Map(board.branches.map((b) => [b.id, b.name]));
  const showBranch = !board.filters.branchId && board.branches.length > 1;

  if (!columns.length) {
    return (
      <Card>
        <EmptyState
          icon="calendar"
          title={filtered ? "No appointments match these filters" : `No ${upcoming ? "upcoming " : ""}appointments on ${formatDay(board.date)}`}
          description={
            readOnly
              ? "Demo data is read-only, so there are no bookings to show. Connect a database to take bookings."
              : filtered
                ? "Try another status or branch, or clear the filters."
                : upcoming
                  ? "Bookings and walk-ins still to come this day appear here. Choose All to include finished and closed ones."
                  : "Bookings and walk-ins for this day will appear here."
          }
          action={
            readOnly ? undefined : (
              <ButtonLink href={bookHref(board, null, null)} icon="plus">
                Book an appointment
              </ButtonLink>
            )
          }
        />
      </Card>
    );
  }

  return (
    <div className="-mx-1 flex gap-6 overflow-x-auto px-1 pb-6" role="list" aria-label="Team schedule">
      {columns.map((column) => (
        <section key={column.key} role="listitem" aria-label={column.name} className="flex w-[19rem] shrink-0 flex-col gap-4">
          <header className="flex items-center gap-3 rounded-card border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-card">
            {column.staffId ? (
              <Avatar name={column.name} />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-high text-secondary" aria-hidden>
                <Icon name="user" size={18} />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="truncate font-headline text-body-md font-semibold text-on-surface">{column.name}</h3>
              <p className="truncate text-label-sm text-secondary">
                {column.title ? `${column.title} · ` : ""}
                {pluralize(column.appointments.length, "appointment")}
              </p>
            </div>
          </header>
          <div className="flex flex-col gap-4">
            {column.appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                timezone={board.timezone}
                currency={currency}
                billing={{ canCheckout, receiptId: receipts[appointment.id] } satisfies CardBilling}
                branchName={showBranch ? branchNames.get(appointment.branchId) : undefined}
                readOnly={readOnly}
                now={board.now}
              />
            ))}
            {!readOnly && column.staffId && !statusFiltered && (
              <Link
                href={bookHref(board, column.staffId, column.branchId)}
                className="flex items-center justify-center gap-1 rounded-card border-2 border-dashed border-outline-variant/40 py-5 text-label-md text-secondary transition-colors hover:border-primary hover:bg-primary-fixed/20 hover:text-primary"
              >
                <Icon name="plus" size={16} />
                {column.appointments.length ? "Book another slot" : "Book a slot"}
              </Link>
            )}
            {!column.appointments.length && (readOnly || statusFiltered) &&<p className="px-1 text-body-sm text-secondary">Nothing scheduled.</p>}
          </div>
        </section>
      ))}
    </div>
  );
}
