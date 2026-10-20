import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatTile } from "@/components/ui/stat-tile";
import { TableShell, type TableColumn } from "@/components/ui/table-shell";
import { BillingBranchFilter } from "@/components/views/billing/billing-branch-filter";
import { DemoDataBadge } from "@/components/views/shared/demo-data-badge";
import { formatMoney } from "@/lib/format";
import { getBillingOverview } from "@/server/billing/queries";
import { PAYMENT_METHOD_LABELS } from "@/server/billing/schema";

export const metadata: Metadata = { title: "Billing" };

type Overview = Awaited<ReturnType<typeof getBillingOverview>>;
type PaymentRow = Overview["recent"][number];
type TicketRow = Overview["openTickets"][number];

const dateFmt = (at: Date, timeZone: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(at);

function paymentColumns(currency: string, timezone: string, branchNames: Map<string, string>): TableColumn<PaymentRow>[] {
  return [
    { key: "paidAt", header: "When", cellClassName: "text-secondary", renderCell: (payment) => dateFmt(payment.paidAt, timezone) },
    {
      key: "customer",
      header: "Customer",
      cellClassName: "font-medium text-on-surface",
      // A payment with no bill (older data) has no customer on record; a bill without one is a walk-in.
      renderCell: (payment) => (payment.invoiceId ? (payment.customerName ?? "Walk-in") : <span className="text-secondary">—</span>),
    },
    { key: "branch", header: "Branch", cellClassName: "text-secondary", renderCell: (payment) => branchNames.get(payment.branchId) ?? "—" },
    {
      key: "receipt",
      header: "Receipt",
      renderCell: (payment) =>
        payment.invoiceId && payment.receiptNumber ? (
          <Link href={`/billing/receipts/${payment.invoiceId}`} className="text-primary hover:underline">
            {payment.receiptNumber}
          </Link>
        ) : (
          <span className="text-secondary">-</span>
        ),
    },
    { key: "amount", header: "Amount", cellClassName: "font-semibold text-on-surface", renderCell: (payment) => formatMoney(payment.amountCents, currency) },
    { key: "method", header: "Method", renderCell: (payment) => <Badge>{PAYMENT_METHOD_LABELS[payment.method]}</Badge> },
  ];
}

function ticketColumns(currency: string, timezone: string): TableColumn<TicketRow>[] {
  return [
    { key: "when", header: "Appointment", cellClassName: "text-secondary", renderCell: (t) => dateFmt(t.startsAt, timezone) },
    { key: "customer", header: "Customer", cellClassName: "font-medium text-on-surface", renderCell: (t) => t.customerName ?? "Walk-in" },
    { key: "services", header: "Services", cellClassName: "text-secondary", renderCell: (t) => t.serviceName ?? "-" },
    { key: "total", header: "Total", cellClassName: "font-semibold text-on-surface", renderCell: (t) => formatMoney(t.totalCents, currency) },
    {
      key: "action",
      header: "",
      align: "right",
      renderCell: (t) => (
        <ButtonLink href={`/billing/checkout/${t.appointmentId}`} variant="accent" size="sm" icon="banknote">
          Checkout
        </ButtonLink>
      ),
    },
  ];
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { recent, branches, filters, openTickets, revenueTodayCents, averageTicketTodayCents, currency, timezone, source } = await getBillingOverview(await searchParams);
  const branchNames = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <>
      <PageHeader title="Billing" description="Checkout, payments and today's takings." meta={<DemoDataBadge source={source} />} />

      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-3">
        <StatTile label="Collected today" value={formatMoney(revenueTodayCents, currency)} icon="banknote" />
        <StatTile label="Open tickets" value={openTickets.length} icon="receipt" hint="Completed services awaiting payment" />
        <StatTile label="Avg. ticket" value={averageTicketTodayCents === null ? "—" : formatMoney(averageTicketTodayCents, currency)} icon="trending-up" hint="Today's paid bills" />
      </div>

      <PageSection title="Awaiting payment">
        <TableShell
          columns={ticketColumns(currency, timezone)}
          rows={openTickets}
          rowKey={(ticket) => ticket.appointmentId}
          empty={<EmptyState icon="receipt" title="Nothing to collect" description="Completed appointments that haven't been paid will appear here." />}
        />
      </PageSection>

      <PageSection title="Recent payments" action={branches.length > 1 || filters.branchId ? <BillingBranchFilter branches={branches} branchId={filters.branchId} /> : undefined}>
        <TableShell
          columns={paymentColumns(currency, timezone, branchNames)}
          rows={recent}
          rowKey={(payment) => payment.id}
          empty={
            filters.branchId ? (
              <EmptyState icon="receipt" title="No payments for this branch" description="Choose another branch, or all branches, to see more." />
            ) : (
              <EmptyState icon="receipt" title="No payments recorded" description="Payments will appear here as you check clients out." />
            )
          }
        />
      </PageSection>
    </>
  );
}
