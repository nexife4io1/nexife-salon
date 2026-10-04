import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatTile } from "@/components/ui/stat-tile";
import { TableShell, type TableColumn } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { formatMoney } from "@/lib/format";
import { getBillingOverview } from "@/server/billing/queries";
import { getCurrentTenant } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Billing" };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type PaymentRow = Awaited<ReturnType<typeof getBillingOverview>>["recent"][number];

function paymentColumns(currency: string): TableColumn<PaymentRow>[] {
  return [
    {
      key: "paidAt",
      header: "When",
      cellClassName: "text-secondary",
      renderCell: (payment) => dateFmt.format(payment.paidAt),
    },
    {
      key: "amount",
      header: "Amount",
      cellClassName: "font-semibold text-on-surface",
      renderCell: (payment) => formatMoney(payment.amountCents, currency),
    },
    {
      key: "method",
      header: "Method",
      renderCell: (payment) => <Badge>{payment.method.toUpperCase()}</Badge>,
    },
    {
      key: "appointment",
      header: "Appointment",
      cellClassName: "text-secondary",
      renderCell: (payment) => (payment.appointmentId ? "Linked" : "-"),
    },
  ];
}

export default async function BillingPage() {
  const [{ recent, revenueTodayCents }, tenant] = await Promise.all([getBillingOverview(), getCurrentTenant()]);
  const currency = tenant?.currency ?? "USD";

  return (
    <>
      <PageHeader title="Billing" description="Checkout, payments and today's takings." />
      <PlaceholderNote step="step 7 (Billing + Payments)">
        Checkout from an appointment, split payments, receipts and refunds via server/billing/actions.ts.
      </PlaceholderNote>

      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-3">
        <StatTile label="Collected today" value={formatMoney(revenueTodayCents, currency)} icon="banknote" />
        <StatTile label="Open tickets" value="—" icon="receipt" hint="Unpaid completed services" />
        <StatTile label="Avg. ticket" value="—" icon="trending-up" hint="Coming with payments ledger" />
      </div>

      <PageSection title="Recent payments">
        <TableShell
          columns={paymentColumns(currency)}
          rows={recent}
          rowKey={(payment) => payment.id}
          empty={<EmptyState icon="receipt" title="No payments recorded" description="Payments will appear here as you check clients out." />}
        />
      </PageSection>
    </>
  );
}
