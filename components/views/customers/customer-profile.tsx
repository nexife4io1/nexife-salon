import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { TableShell, type TableColumn } from "@/components/ui/table-shell";
import { formatDate, formatMoney, pluralize } from "@/lib/format";
import { APPOINTMENT_STATUS_LABELS, type Appointment, type AppointmentStatus } from "@/server/appointments/schema";
import type { CustomerBilling } from "@/server/billing/schema";
import { CUSTOMER_GENDER_LABELS, type CustomerProfile } from "@/server/customers/schema";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="eyebrow mb-1">{label}</dt>
      <dd className="text-body-md text-on-surface">{children}</dd>
    </div>
  );
}

const notProvided = <span className="text-secondary">Not provided</span>;

const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = { booked: "neutral", checked_in: "warning", in_service: "gold", completed: "success", cancelled: "error", no_show: "error" };

type HistoryRow = Appointment & { receiptId?: string };

/** Visit history and spend come from the appointments and billing modules; `billing` is null when the viewer can't see billing. */
export type CustomerActivity = { appointments: Appointment[]; billing: CustomerBilling | null; currency: string; timezone: string };

function historyColumns({ currency, timezone, showPayment }: { currency: string; timezone: string; showPayment: boolean }): TableColumn<HistoryRow>[] {
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: timezone });
  const columns: TableColumn<HistoryRow>[] = [
    { key: "date", header: "Date", cellClassName: "text-secondary whitespace-nowrap", renderCell: (a) => day.format(a.startsAt) },
    { key: "staff", header: "Staff", cellClassName: "text-secondary", renderCell: (a) => a.staffName ?? "Unassigned" },
    { key: "services", header: "Services", cellClassName: "text-on-surface", renderCell: (a) => a.serviceName ?? "Service removed" },
    { key: "amount", header: "Amount", cellClassName: "font-semibold text-on-surface", renderCell: (a) => (a.services.length ? formatMoney(a.totalCents, currency) : "-") },
    { key: "status", header: "Status", renderCell: (a) => <Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge> },
  ];
  if (showPayment) {
    columns.push({
      key: "payment",
      header: "Payment",
      renderCell: (a) =>
        a.receiptId ? (
          <Link href={`/billing/receipts/${a.receiptId}`} className="text-primary hover:underline">
            Paid · Receipt
          </Link>
        ) : a.status === "completed" ? (
          <Link href={`/billing/checkout/${a.id}`} className="text-primary hover:underline">
            Unpaid · Checkout
          </Link>
        ) : (
          <span className="text-secondary">-</span>
        ),
    });
  }
  return columns;
}

/** Everything stored about one customer, plus their appointment and billing history. */
export function CustomerProfileView({ customer, activity }: { customer: CustomerProfile; activity: CustomerActivity }) {
  const { billing, currency, timezone } = activity;
  const receipts = new Map(billing?.invoices.flatMap((i) => (i.appointmentId ? [[i.appointmentId, i.id] as const] : [])));
  const rows: HistoryRow[] = activity.appointments.map((a) => ({ ...a, receiptId: receipts.get(a.id) }));
  const completed = activity.appointments.filter((a) => a.status === "completed").length;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-3">
        <StatTile label="Total visits" value={customer.visitCount} hint={pluralize(completed, "completed appointment")} icon="calendar" />
        {billing && <StatTile label="Lifetime spend" value={formatMoney(billing.lifetimeSpendCents, currency)} hint={pluralize(billing.paidCount, "paid bill")} icon="banknote" />}
        <StatTile label="Customer since" value={<span className="text-headline-md">{formatDate(customer.createdAt)}</span>} icon="user" />
      </div>

      <Card padding="lg" className="p-6 md:p-8">
        <div className="mb-8 flex items-center gap-4">
          <Avatar name={customer.name} />
          <h2 className="font-headline text-headline-sm font-semibold text-on-surface">{customer.name}</h2>
        </div>
        <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Detail label="Contact number">{customer.phone ?? notProvided}</Detail>
          <Detail label="Email address">{customer.email ?? notProvided}</Detail>
          <Detail label="Birthday">{customer.birthday ? formatDate(customer.birthday) : notProvided}</Detail>
          <Detail label="Gender">{customer.gender ? CUSTOMER_GENDER_LABELS[customer.gender] : notProvided}</Detail>
        </dl>
      </Card>

      <section aria-labelledby="visit-history">
        <h2 id="visit-history" className="mb-4 font-headline text-headline-sm font-semibold text-on-surface">
          Visit history
        </h2>
        <TableShell
          columns={historyColumns({ currency, timezone, showPayment: billing !== null })}
          rows={rows}
          rowKey={(a) => a.id}
          empty={<EmptyState icon="calendar" title="No appointments yet" description="Bookings and walk-ins for this customer will appear here." />}
        />
      </section>

      <Card padding="lg" className="p-6 md:p-8">
        <CardHeader title="Notes" />
        {customer.notes ? <p className="whitespace-pre-wrap text-body-md text-on-surface">{customer.notes}</p> : <p className="text-body-sm text-secondary">No notes yet.</p>}
      </Card>
    </div>
  );
}
