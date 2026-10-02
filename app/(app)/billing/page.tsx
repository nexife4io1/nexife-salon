import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatTile } from "@/components/ui/stat-tile";
import { TableShell } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { formatMoney } from "@/lib/format";
import { getBillingOverview } from "@/server/billing/queries";
import { getCurrentTenant } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Billing" };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

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
          columns={["When", "Amount", "Method", "Appointment"]}
          empty={<EmptyState icon="receipt" title="No payments recorded" description="Payments will appear here as you check clients out." />}
        >
          {recent.length > 0 &&
            recent.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-4 text-secondary">{dateFmt.format(p.paidAt)}</td>
                <td className="px-6 py-4 font-semibold text-on-surface">{formatMoney(p.amountCents, currency)}</td>
                <td className="px-6 py-4">
                  <Badge>{p.method.toUpperCase()}</Badge>
                </td>
                <td className="px-6 py-4 text-secondary">{p.appointmentId ? "Linked" : "—"}</td>
              </tr>
            ))}
        </TableShell>
      </PageSection>
    </>
  );
}
