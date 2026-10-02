import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatTile } from "@/components/ui/stat-tile";
import { TableShell } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { formatMoney } from "@/lib/format";
import { getFinanceSummary } from "@/server/finance/queries";
import { getCurrentTenant } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage() {
  const [summary, tenant] = await Promise.all([getFinanceSummary(), getCurrentTenant()]);
  const currency = tenant?.currency ?? "USD";

  return (
    <>
      <PageHeader
        title="Finance"
        description="Month-to-date income, expenses and margin."
        actions={
          <Button variant="secondary" icon="plus" disabled title="Arrives in step 9">
            Add Expense
          </Button>
        }
      />
      <PlaceholderNote step="step 9 (Finance)">
        Expense logging, payments revenue roll-up from billing, P&amp;L by branch and exports.
      </PlaceholderNote>

      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-3">
        <StatTile label="Income (MTD)" value={formatMoney(summary.incomeCents, currency)} icon="trending-up" />
        <StatTile label="Expenses (MTD)" value={formatMoney(summary.expenseCents, currency)} icon="receipt" />
        <StatTile label="Net (MTD)" value={formatMoney(summary.netCents, currency)} icon="chart" />
      </div>

      <PageSection title="Entries this month">
        <TableShell columns={["Date", "Type", "Category", "Amount", "Note"]} empty={<EmptyState icon="chart" title="No entries this month" />}>
          {summary.entries.length > 0 &&
            summary.entries.map((e) => (
              <tr key={e.id}>
                <td className="px-6 py-4 text-secondary">{e.occurredOn}</td>
                <td className="px-6 py-4">
                  <Badge tone={e.type === "income" ? "success" : "neutral"}>{e.type}</Badge>
                </td>
                <td className="px-6 py-4">{e.category}</td>
                <td className="px-6 py-4 font-semibold text-on-surface">{formatMoney(e.amountCents, currency)}</td>
                <td className="px-6 py-4 text-secondary">{e.note ?? "—"}</td>
              </tr>
            ))}
        </TableShell>
      </PageSection>
    </>
  );
}
