import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatTile } from "@/components/ui/stat-tile";
import { TableShell } from "@/components/ui/table-shell";
import { PlaceholderNote } from "@/components/views/shared/placeholder-note";
import { getInventory } from "@/server/inventory/queries";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const { items, lowStock } = await getInventory();

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Retail and back-bar stock across your branches."
        actions={
          <Button variant="secondary" icon="plus" disabled title="Arrives in step 8">
            Record Delivery
          </Button>
        }
      />
      <PlaceholderNote step="step 8 (Inventory)">
        Item catalog, stock movements (append-only ledger), low-stock alerts and auto-deduction on service completion.
      </PlaceholderNote>

      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
        <StatTile label="Items tracked" value={items.length} icon="package" />
        <StatTile label="Low stock" value={lowStock.length} icon="bell" hint="At or below reorder level" />
      </div>

      <PageSection title="Stock on hand">
        <TableShell columns={["Item", "SKU", "On hand", "Reorder at", "Status"]} empty={<EmptyState icon="package" title="No items yet" />}>
          {items.length > 0 &&
            items.map((i) => (
              <tr key={i.id}>
                <td className="px-6 py-4 font-semibold text-on-surface">{i.name}</td>
                <td className="px-6 py-4 text-secondary">{i.sku ?? "—"}</td>
                <td className="px-6 py-4">
                  {i.onHand} {i.unit}
                </td>
                <td className="px-6 py-4 text-secondary">{i.reorderLevel}</td>
                <td className="px-6 py-4">{i.onHand <= i.reorderLevel ? <Badge tone="warning">Reorder</Badge> : <Badge tone="success">In stock</Badge>}</td>
              </tr>
            ))}
        </TableShell>
      </PageSection>
    </>
  );
}
