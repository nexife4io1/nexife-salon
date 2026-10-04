import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatTile } from "@/components/ui/stat-tile";
import { TableShell, type TableColumn } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { formatMoney } from "@/lib/format";
import { getFinanceSummary } from "@/server/finance/queries";
import { getCurrentTenant } from "@/server/tenants/queries";

export const metadata: Metadata = { title: "Finance" };

type FinanceEntryRow = Awaited<ReturnType<typeof getFinanceSummary>>["entries"][number];

function financeColumns(currency: string): TableColumn<FinanceEntryRow>[] {
  return [
    {
      key: "occurredOn",
      header: "Date",
      cellClassName: "text-secondary",
      renderCell: (entry) => entry.occurredOn,
    },
    {
      key: "type",
      header: "Type",
      renderCell: (entry) => <Badge tone={entry.type === "income" ? "success" : "neutral"}>{entry.type}</Badge>,
    },
    {
      key: "category",
      header: "Category",
      renderCell: (entry) => entry.category,
    },
    {
      key: "amountCents",
      header: "Amount",
      cellClassName: "font-semibold text-on-surface",
      renderCell: (entry) => formatMoney(entry.amountCents, currency),
    },
    {
      key: "note",
      header: "Note",
      cellClassName: "text-secondary",
      renderCell: (entry) => entry.note ?? "-",
    },
  ];
}

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
        <TableShell
          columns={financeColumns(currency)}
          rows={summary.entries}
          rowKey={(entry) => entry.id}
          empty={<EmptyState icon="chart" title="No entries this month" />}
        />
      </PageSection>
    </>
  );
}
